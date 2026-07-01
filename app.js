/**
 * app.js - Modernized Logic
 * Auto-Date calculation for Jalali calendar, exact year parsing, and Lawyer Fee Tariff 1405.
 */

const PERSIAN_MONTHS = [
    { value: 1, name: "فروردین" }, { value: 2, name: "اردیبهشت" }, { value: 3, name: "خرداد" },
    { value: 4, name: "تیر" }, { value: 5, name: "مرداد" }, { value: 6, name: "شهریور" },
    { value: 7, name: "مهر" }, { value: 8, name: "آبان" }, { value: 9, name: "آذر" },
    { value: 10, name: "دی" }, { value: 11, name: "بهمن" }, { value: 12, name: "اسفند" }
];

const STORAGE_KEY = 'iran_delay_calculator_modern_state';
const DATA_URL = 'data/indices.json';

class NumberUtils {
    static toEnglishDigits(str) {
        if (!str) return '';
        const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        
        return str.split('').map(char => {
            let pIndex = persianNumbers.indexOf(char);
            if (pIndex >= 0) return pIndex;
            let aIndex = arabicNumbers.indexOf(char);
            if (aIndex >= 0) return aIndex;
            return char;
        }).join('');
    }

    static cleanNumber(str) {
        return str.replace(/[,٬]/g, '').trim();
    }

    static parseFloatStrict(str) {
        const cleaned = this.cleanNumber(this.toEnglishDigits(str));
        return parseFloat(cleaned);
    }

    // Numbers like amount (with comma separation)
    static formatCurrency(num) {
        if (num === null || isNaN(num)) return '';
        return new Intl.NumberFormat('fa-IR').format(num);
    }

    // Formats year numbers to Persian string WITHOUT thousands separators
    static formatYear(year) {
        if (!year) return '';
        return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(year);
    }
}

class PersianWordUtils {
    static numToWords(num) {
        if (num === 0) return 'صفر';
        if (isNaN(num) || num === null) return '';
        
        const units = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
        const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
        const tens = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
        const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
        const thousands = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

        function getThreeDigits(n) {
            let res = [];
            let h = Math.floor(n / 100);
            let t = Math.floor((n % 100) / 10);
            let u = n % 10;

            if (h > 0) res.push(hundreds[h]);
            if (t === 1) {
                res.push(teens[u]);
            } else {
                if (t > 1) res.push(tens[t]);
                if (u > 0) res.push(units[u]);
            }
            return res.join(' و ');
        }

        let numStr = Math.floor(num).toString();
        let groups = [];
        while (numStr.length > 0) {
            groups.push(numStr.slice(-3));
            numStr = numStr.slice(0, -3);
        }

        let words = [];
        for (let i = 0; i < groups.length; i++) {
            let val = parseInt(groups[i], 10);
            if (val > 0) {
                let groupWord = getThreeDigits(val);
                if (thousands[i]) {
                    groupWord += ' ' + thousands[i];
                }
                words.unshift(groupWord);
            }
        }
        return words.join(' و ');
    }

    static convertRialsToTomanWords(rials) {
        if (isNaN(rials) || rials <= 0) return '';
        const tomans = Math.floor(rials / 10);
        return 'معادل: ' + this.numToWords(tomans) + ' تومان';
    }
}

class DateUtils {
    static getCurrentJalaliDate() {
        const date = new Date();
        const dtf = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric' });
        const parts = dtf.formatToParts(date);
        
        let year, month;
        for (const p of parts) {
            if (p.type === 'year') year = parseInt(p.value, 10);
            if (p.type === 'month') month = parseInt(p.value, 10);
        }
        return { year, month };
    }
}

class DataService {
    constructor() {
        this.indices = [];
        this.availableYears = [];
    }

    async loadIndices() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.indices = await response.json();
            this.extractAvailableYears();
            return true;
        } catch (error) {
            console.error("Failed to load index data:", error);
            return false;
        }
    }

    extractAvailableYears() {
        const yearsSet = new Set(this.indices.map(item => item['سال']));
        this.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    }

    getIndex(year, monthValue) {
        const yearData = this.indices.find(item => item['سال'] === year);
        if (!yearData) return null;

        const monthObj = PERSIAN_MONTHS.find(m => m.value === monthValue);
        if (!monthObj) return null;

        const indexValue = yearData[monthObj.name];
        if (indexValue === null || indexValue === undefined) return null;
        
        return indexValue;
    }
}

class Calculator {
    static compute(principal, startIndex, endIndex) {
        const multiplier = endIndex / startIndex;
        const delayAmount = principal * (multiplier - 1);
        const finalAmount = principal * multiplier;

        return {
            delayAmount: Math.round(delayAmount),
            finalAmount: Math.round(finalAmount)
        };
    }
}

class LawyerCalculator {
    static calculate(principal, membershipType) {
        // Tiers according to Article 9 (Rials)
        const tier1 = Math.min(principal, 500000000) * 0.08;
        const tier2 = Math.max(0, Math.min(principal, 2000000000) - 500000000) * 0.07;
        const tier3 = Math.max(0, Math.min(principal, 10000000000) - 2000000000) * 0.05;
        const tier4 = Math.max(0, Math.min(principal, 30000000000) - 10000000000) * 0.04;
        const tier5 = Math.max(0, principal - 30000000000) * 0.03;

        const totalFee = tier1 + tier2 + tier3 + tier4 + tier5;
        const effectiveRate = (totalFee / principal) * 100;

        // Article 21 Split
        const badvi = totalFee * 0.60;
        const tajdid = totalFee * 0.40;

        // Article 25 (Execution) - 2% of Executed Amount, minimum 4,000,000 Rials
        const ejra = Math.max(4000000, principal * 0.02);

        const sumBeforeDeduction = totalFee + ejra;

        // Article 29 Deductions
        const calculateDeductionsForPhase = (amount) => {
            const tax = amount * 0.05;
            let fund = 0;
            let associationShare = 0;

            if (membershipType === 'kanon') {
                fund = tax * 0.50;               // 50% of tax
                associationShare = tax * 0.25;   // 25% of tax
            } else {
                fund = amount * 0.05;            // Center gets 5% of lawyer's fee (identical to tax)
                associationShare = 0;
            }

            const totalDeductions = tax + fund + associationShare;
            const netIncome = amount - totalDeductions;

            return { tax, fund, associationShare, totalDeductions, netIncome };
        };

        const badviDeductions = calculateDeductionsForPhase(badvi);
        const tajdidDeductions = calculateDeductionsForPhase(tajdid);
        const ejraDeductions = calculateDeductionsForPhase(ejra);

        const totalDeductionsAll = badviDeductions.totalDeductions + tajdidDeductions.totalDeductions + ejraDeductions.totalDeductions;
        const netIncomeAll = sumBeforeDeduction - totalDeductionsAll;

        return {
            totalFee,
            effectiveRate,
            badvi,
            tajdid,
            ejra,
            sumBeforeDeduction,
            totalDeductionsAll,
            netIncomeAll,
            badviDeductions,
            tajdidDeductions,
            ejraDeductions
        };
    }
}

class UIController {
    constructor() {
        this.dataService = new DataService();
        this.cacheDOM();
        this.bindEvents();
    }

    cacheDOM() {
        // Tab 1 Elements
        this.form = document.getElementById('calc-form');
        this.principalInput = document.getElementById('principal');
        this.principalWords = document.getElementById('principal-words');
        this.startYearSelect = document.getElementById('start-year');
        this.startMonthSelect = document.getElementById('start-month');
        this.endYearSelect = document.getElementById('end-year');
        this.endMonthSelect = document.getElementById('end-month');
        this.btnClear = document.getElementById('btn-clear');
        this.btnCopy = document.getElementById('btn-copy');
        this.errorContainer = document.getElementById('error-container');
        this.resultCard = document.getElementById('result-card');
        this.calculatorCard = document.getElementById('calculator-card');
        this.loadingSpinner = document.getElementById('loading-spinner');
        this.resPrincipalAmount = document.getElementById('res-principal-amount');
        this.resDelayAmount = document.getElementById('res-delay-amount');
        this.resFinalAmount = document.getElementById('res-final-amount');

        // Tab 2 Elements
        this.lawyerForm = document.getElementById('lawyer-form');
        this.lawyerPrincipalInput = document.getElementById('lawyer-principal');
        this.lawyerPrincipalWords = document.getElementById('lawyer-principal-words');
        this.membershipTypeSelect = document.getElementById('membership-type');
        this.btnLawyerClear = document.getElementById('btn-lawyer-clear');
        this.btnCopyLawyer = document.getElementById('btn-copy-lawyer');
        this.lawyerResultCard = document.getElementById('lawyer-result-card');

        // Tab 2 Output DOM Elements
        this.lawyerResPrincipal = document.getElementById('lawyer-res-principal');
        this.lawyerResRate = document.getElementById('lawyer-res-rate');
        this.lawyerResTotalFee = document.getElementById('lawyer-res-total-fee');
        this.lawyerResBadvi = document.getElementById('lawyer-res-badvi');
        this.lawyerResTajdid = document.getElementById('lawyer-res-tajdid');
        this.lawyerResEjra = document.getElementById('lawyer-res-ejra');

        // Phase-by-phase Deductions Outputs
        this.lawyerResBadviTax = document.getElementById('lawyer-res-badvi-tax');
        this.lawyerResBadviFundLabel = document.getElementById('lawyer-res-badvi-fund-label');
        this.lawyerResBadviFund = document.getElementById('lawyer-res-badvi-fund');
        this.lawyerResBadviAssocRow = document.getElementById('lawyer-res-badvi-assoc-row');
        this.lawyerResBadviAssoc = document.getElementById('lawyer-res-badvi-assoc');
        this.lawyerResBadviNet = document.getElementById('lawyer-res-badvi-net');

        this.lawyerResTajdidTax = document.getElementById('lawyer-res-tajdid-tax');
        this.lawyerResTajdidFundLabel = document.getElementById('lawyer-res-tajdid-fund-label');
        this.lawyerResTajdidFund = document.getElementById('lawyer-res-tajdid-fund');
        this.lawyerResTajdidAssocRow = document.getElementById('lawyer-res-tajdid-assoc-row');
        this.lawyerResTajdidAssoc = document.getElementById('lawyer-res-tajdid-assoc');
        this.lawyerResTajdidNet = document.getElementById('lawyer-res-tajdid-net');

        this.lawyerResEjraTax = document.getElementById('lawyer-res-ejra-tax');
        this.lawyerResEjraFundLabel = document.getElementById('lawyer-res-ejra-fund-label');
        this.lawyerResEjraFund = document.getElementById('lawyer-res-ejra-fund');
        this.lawyerResEjraAssocRow = document.getElementById('lawyer-res-ejra-assoc-row');
        this.lawyerResEjraAssoc = document.getElementById('lawyer-res-ejra-assoc');
        this.lawyerResEjraNet = document.getElementById('lawyer-res-ejra-net');

        // Consolidated Summary Outputs
        this.lawyerResSumBefore = document.getElementById('lawyer-res-sum-before');
        this.lawyerResTotalDeductions = document.getElementById('lawyer-res-total-deductions');
        this.lawyerResFinalNet = document.getElementById('lawyer-res-final-net');
    }

    bindEvents() {
        // Tab 1 Listeners
        this.form.addEventListener('submit', (e) => this.handleCalculate(e));
        this.btnClear.addEventListener('click', () => this.clearForm());
        this.btnCopy.addEventListener('click', () => this.copyResults());
        this.principalInput.addEventListener('input', (e) => this.formatPrincipalInput(e));

        // Tab 2 Listeners
        this.lawyerForm.addEventListener('submit', (e) => this.handleCalculateLawyer(e));
        this.btnLawyerClear.addEventListener('click', () => this.clearLawyerForm());
        this.btnCopyLawyer.addEventListener('click', () => this.copyLawyerResults());
        this.lawyerPrincipalInput.addEventListener('input', (e) => this.formatLawyerPrincipalInput(e));
    }

    async init() {
        const success = await this.dataService.loadIndices();
        this.loadingSpinner.classList.add('d-none');
        
        if (!success) {
            this.showError("خطا در دریافت اطلاعات. لطفاً وضعیت اینترنت را بررسی کنید.");
            return;
        }

        this.calculatorCard.classList.remove('d-none');
        this.populateDropdowns();
        this.setAutomaticEndDate();
        this.restoreState();
    }

    populateDropdowns() {
        const yearOptions = this.dataService.availableYears.map(year => 
            `<option value="${year}">${NumberUtils.formatYear(year)}</option>`
        ).join('');
        
        this.startYearSelect.innerHTML += yearOptions;
        this.endYearSelect.innerHTML += yearOptions;

        const monthOptions = PERSIAN_MONTHS.map(m => 
            `<option value="${m.value}">${m.name}</option>`
        ).join('');
        
        this.startMonthSelect.innerHTML += monthOptions;
        this.endMonthSelect.innerHTML += monthOptions;
    }

    setAutomaticEndDate() {
        try {
            const today = DateUtils.getCurrentJalaliDate();
            if (this.dataService.availableYears.includes(today.year)) {
                this.endYearSelect.value = today.year;
                this.endMonthSelect.value = today.month;
            }
        } catch (e) {
            console.warn("Could not automatically set Jalali date", e);
        }
    }

    formatPrincipalInput(e) {
        const rawValue = e.target.value;
        const number = NumberUtils.parseFloatStrict(rawValue);
        if (isNaN(number)) {
            e.target.value = '';
            this.principalWords.textContent = '';
        } else {
            e.target.value = NumberUtils.formatCurrency(number);
            this.principalWords.textContent = PersianWordUtils.convertRialsToTomanWords(number);
        }
    }

    formatLawyerPrincipalInput(e) {
        const rawValue = e.target.value;
        const number = NumberUtils.parseFloatStrict(rawValue);
        if (isNaN(number)) {
            e.target.value = '';
            this.lawyerPrincipalWords.textContent = '';
        } else {
            e.target.value = NumberUtils.formatCurrency(number);
            this.lawyerPrincipalWords.textContent = PersianWordUtils.convertRialsToTomanWords(number);
        }
    }

    showError(message) {
        this.errorContainer.textContent = message;
        this.errorContainer.classList.remove('d-none');
        this.resultCard.classList.add('d-none');
    }

    hideError() {
        this.errorContainer.classList.add('d-none');
        this.errorContainer.textContent = '';
    }

    handleCalculate(e) {
        e.preventDefault();
        this.hideError();

        const principal = NumberUtils.parseFloatStrict(this.principalInput.value);
        const startYear = parseInt(this.startYearSelect.value, 10);
        const startMonth = parseInt(this.startMonthSelect.value, 10);
        const endYear = parseInt(this.endYearSelect.value, 10);
        const endMonth = parseInt(this.endMonthSelect.value, 10);

        if (!principal || principal <= 0) {
            return this.showError("لطفاً مبلغ معتبری برای اصل دین وارد کنید.");
        }
        if (!startYear || !startMonth || !endYear || !endMonth) {
            return this.showError("لطفاً تاریخ شروع و پایان را به درستی انتخاب کنید.");
        }

        const startIndex = this.dataService.getIndex(startYear, startMonth);
        const endIndex = this.dataService.getIndex(endYear, endMonth);

        if (startIndex === null) {
            const mName = PERSIAN_MONTHS.find(m=>m.value === startMonth).name;
            return this.showError(`شاخص تاریخ مبدأ (${mName} ${NumberUtils.formatYear(startYear)}) اعلام نشده است.`);
        }
        if (endIndex === null) {
            const mName = PERSIAN_MONTHS.find(m=>m.value === endMonth).name;
            return this.showError(`شاخص تاریخ مقصد (${mName} ${NumberUtils.formatYear(endYear)}) هنوز اعلام نشده است.`);
        }

        const results = Calculator.compute(principal, startIndex, endIndex);
        this.displayResults(principal, results);

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            principal: this.principalInput.value,
            startYear, startMonth, endYear, endMonth
        }));
    }

    displayResults(principal, results) {
        this.resPrincipalAmount.textContent = NumberUtils.formatCurrency(principal) + ' ریال';
        this.resDelayAmount.textContent = NumberUtils.formatCurrency(results.delayAmount) + ' ریال';
        this.resFinalAmount.textContent = NumberUtils.formatCurrency(results.finalAmount) + ' ریال';

        this.resultCard.classList.remove('d-none');
        this.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    handleCalculateLawyer(e) {
        e.preventDefault();
        const principal = NumberUtils.parseFloatStrict(this.lawyerPrincipalInput.value);
        const membershipType = this.membershipTypeSelect.value;

        if (!principal || principal <= 0) {
            alert("لطفاً مبلغ معتبری برای بهای خواسته وارد کنید.");
            return;
        }

        const results = LawyerCalculator.calculate(principal, membershipType);
        this.displayLawyerResults(principal, results, membershipType);
    }

    displayLawyerResults(principal, results, membershipType) {
        this.lawyerResPrincipal.textContent = NumberUtils.formatCurrency(principal) + ' ریال';
        this.lawyerResRate.textContent = results.effectiveRate.toFixed(2) + '%';
        
        // Article 9 Outputs
        this.lawyerResTotalFee.textContent = NumberUtils.formatCurrency(results.totalFee) + ' ریال';
        this.lawyerResBadvi.textContent = NumberUtils.formatCurrency(results.badvi) + ' ریال';
        this.lawyerResTajdid.textContent = NumberUtils.formatCurrency(results.tajdid) + ' ریال';

        // Article 25 Output
        this.lawyerResEjra.textContent = NumberUtils.formatCurrency(results.ejra) + ' ریال';

        // Set Labels and Values dynamically based on Kanon vs Markaz
        const setDeductionLabels = (isKanon) => {
            const labelStr = isKanon ? "سهم صندوق حمایت (۵۰٪ مالیات):" : "سهم مرکز (۵٪ حق‌الوکاله):";
            this.lawyerResBadviFundLabel.textContent = labelStr;
            this.lawyerResTajdidFundLabel.textContent = labelStr;
            this.lawyerResEjraFundLabel.textContent = labelStr;

            if (isKanon) {
                this.lawyerResBadviAssocRow.classList.remove('d-none');
                this.lawyerResTajdidAssocRow.classList.remove('d-none');
                this.lawyerResEjraAssocRow.classList.remove('d-none');
            } else {
                this.lawyerResBadviAssocRow.classList.add('d-none');
                this.lawyerResTajdidAssocRow.classList.add('d-none');
                this.lawyerResEjraAssocRow.classList.add('d-none');
            }
        };

        const isKanon = (membershipType === 'kanon');
        setDeductionLabels(isKanon);

        // Populate deductions
        this.lawyerResBadviTax.textContent = NumberUtils.formatCurrency(results.badviDeductions.tax) + ' ریال';
        this.lawyerResBadviFund.textContent = NumberUtils.formatCurrency(results.badviDeductions.fund) + ' ریال';
        this.lawyerResBadviNet.textContent = NumberUtils.formatCurrency(results.badviDeductions.netIncome) + ' ریال';

        this.lawyerResTajdidTax.textContent = NumberUtils.formatCurrency(results.tajdidDeductions.tax) + ' ریال';
        this.lawyerResTajdidFund.textContent = NumberUtils.formatCurrency(results.tajdidDeductions.fund) + ' ریال';
        this.lawyerResTajdidNet.textContent = NumberUtils.formatCurrency(results.tajdidDeductions.netIncome) + ' ریال';

        this.lawyerResEjraTax.textContent = NumberUtils.formatCurrency(results.ejraDeductions.tax) + ' ریال';
        this.lawyerResEjraFund.textContent = NumberUtils.formatCurrency(results.ejraDeductions.fund) + ' ریال';
        this.lawyerResEjraNet.textContent = NumberUtils.formatCurrency(results.ejraDeductions.netIncome) + ' ریال';

        if (isKanon) {
            this.lawyerResBadviAssoc.textContent = NumberUtils.formatCurrency(results.badviDeductions.associationShare) + ' ریال';
            this.lawyerResTajdidAssoc.textContent = NumberUtils.formatCurrency(results.tajdidDeductions.associationShare) + ' ریال';
            this.lawyerResEjraAssoc.textContent = NumberUtils.formatCurrency(results.ejraDeductions.associationShare) + ' ریال';
        }

        // Summary Consolidated Cards
        this.lawyerResSumBefore.textContent = NumberUtils.formatCurrency(results.sumBeforeDeduction) + ' ریال';
        this.lawyerResTotalDeductions.textContent = NumberUtils.formatCurrency(results.totalDeductionsAll) + ' ریال';
        this.lawyerResFinalNet.textContent = NumberUtils.formatCurrency(results.netIncomeAll) + ' ریال';

        this.lawyerResultCard.classList.remove('d-none');
        this.lawyerResultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    clearForm() {
        this.form.reset();
        this.hideError();
        this.principalWords.textContent = '';
        this.resultCard.classList.add('d-none');
        localStorage.removeItem(STORAGE_KEY);
        this.setAutomaticEndDate();
        this.principalInput.focus();
    }

    clearLawyerForm() {
        this.lawyerForm.reset();
        this.lawyerPrincipalWords.textContent = '';
        this.lawyerResultCard.classList.add('d-none');
        this.lawyerPrincipalInput.focus();
    }

    restoreState() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const state = JSON.parse(data);
            if (state.principal) {
                this.principalInput.value = state.principal;
                const number = NumberUtils.parseFloatStrict(state.principal);
                if (!isNaN(number)) {
                    this.principalWords.textContent = PersianWordUtils.convertRialsToTomanWords(number);
                }
            }
            if (state.startYear) this.startYearSelect.value = state.startYear;
            if (state.startMonth) this.startMonthSelect.value = state.startMonth;
            if (state.endYear) this.endYearSelect.value = state.endYear;
            if (state.endMonth) this.endMonthSelect.value = state.endMonth;
        }
    }

    async copyResults() {
        const textToCopy = `نتیجه محاسبه خسارت تأخیر تأدیه:
اصل دین: ${this.resPrincipalAmount.textContent}
تاریخ سررسید: ${this.startMonthSelect.options[this.startMonthSelect.selectedIndex].text} ${NumberUtils.formatYear(this.startYearSelect.value)}
تاریخ یوم‌الادا: ${this.endMonthSelect.options[this.endMonthSelect.selectedIndex].text} ${NumberUtils.formatYear(this.endYearSelect.value)}

خالص خسارت: ${this.resDelayAmount.textContent}
مجموع نهایی: ${this.resFinalAmount.textContent}`;

        await this.executeClipboardCopy(textToCopy, this.btnCopy);
    }

    async copyLawyerResults() {
        const membershipStr = this.membershipTypeSelect.options[this.membershipTypeSelect.selectedIndex].text;
        const textToCopy = `محاسبه تعرفه حق‌الوکاله وکلا (مصوب ۱۴۰۵):
بهای خواسته: ${this.lawyerResPrincipal.textContent}
پروانه وکیل: ${membershipStr}
نرخ مؤثر تعرفه: ${this.lawyerResRate.textContent}

۱. حق‌الوکاله دعاوی مالی (ماده ۹):
حق‌الوکاله کل: ${this.lawyerResTotalFee.textContent}
مرحله بدوی (۶۰٪): ${this.lawyerResBadvi.textContent}
مرحله تجدیدنظر (۴۰٪): ${this.lawyerResTajdid.textContent}

۲. حق‌الوکاله امور اجرایی (ماده ۲۵):
مجموع امور اجرایی: ${this.lawyerResEjra.textContent}

۳. مبالغ تجمیعی نهایی:
کل حق‌الوکاله قبل از کسورات: ${this.lawyerResSumBefore.textContent}
کل کسورات قانونی (مالیات و سهم صندوق): ${this.lawyerResTotalDeductions.textContent}
درآمد خالص نهایی وکیل: ${this.lawyerResFinalNet.textContent}`;

        await this.executeClipboardCopy(textToCopy, this.btnCopyLawyer);
    }

    async executeClipboardCopy(text, btnElement) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = btnElement.innerHTML;
            btnElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check-circle me-2" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/></svg> کپی شد!';
            btnElement.classList.add('btn-copied', 'text-white');
            btnElement.classList.remove('btn-outline-primary', 'custom-btn-outline');
            
            setTimeout(() => {
                btnElement.innerHTML = originalHTML;
                btnElement.classList.remove('btn-copied', 'text-white');
                btnElement.classList.add('btn-outline-primary', 'custom-btn-outline');
            }, 2500);
        } catch (err) {
            alert('متأسفانه کپی در مرورگر شما پشتیبانی نمی‌شود.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new UIController();
    app.init();
});
