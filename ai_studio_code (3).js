/**
 * app.js - Main Application Logic
 * Adapted for the specific JSON format where keys are Persian month names.
 */

/* ==========================================================================
   CONSTANTS & CONFIG
   ========================================================================== */
const PERSIAN_MONTHS = [
    { value: 1, name: "فروردین" }, { value: 2, name: "اردیبهشت" }, { value: 3, name: "خرداد" },
    { value: 4, name: "تیر" }, { value: 5, name: "مرداد" }, { value: 6, name: "شهریور" },
    { value: 7, name: "مهر" }, { value: 8, name: "آبان" }, { value: 9, name: "آذر" },
    { value: 10, name: "دی" }, { value: 11, name: "بهمن" }, { value: 12, name: "اسفند" }
];

const STORAGE_KEY = 'iran_delay_calculator_state';
const DATA_URL = 'data/indices.json';

/* ==========================================================================
   UTILITY MODULE
   ========================================================================== */
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

    static formatCurrency(num) {
        if (num === null || isNaN(num)) return '';
        return new Intl.NumberFormat('fa-IR').format(num);
    }

    static formatDecimal(num, decimals = 3) {
        if (num === null || isNaN(num)) return '';
        return new Intl.NumberFormat('fa-IR', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        }).format(num);
    }
}

/* ==========================================================================
   DATA LAYER
   ========================================================================== */
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
        // خواندن کلید "سال" از آرایه‌ها و مرتب‌سازی به صورت نزولی
        const yearsSet = new Set(this.indices.map(item => item['سال']));
        this.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    }

    getIndex(year, monthValue) {
        const yearData = this.indices.find(item => item['سال'] === year);
        if (!yearData) return null;

        const monthObj = PERSIAN_MONTHS.find(m => m.value === monthValue);
        if (!monthObj) return null;

        // خواندن مقدار شاخص بر اساس نام ماه (مثلاً yearData["فروردین"])
        const indexValue = yearData[monthObj.name];
        
        if (indexValue === null || indexValue === undefined) return null;
        
        return indexValue;
    }
}

/* ==========================================================================
   BUSINESS LOGIC
   ========================================================================== */
class Calculator {
    static compute(principal, startIndex, endIndex) {
        const multiplier = endIndex / startIndex;
        const delayAmount = principal * (multiplier - 1);
        const finalAmount = principal * multiplier;

        return {
            multiplier: multiplier,
            delayAmount: Math.round(delayAmount),
            finalAmount: Math.round(finalAmount)
        };
    }
}

/* ==========================================================================
   STORAGE LAYER
   ========================================================================== */
class StorageService {
    static saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    static loadState() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    }
    static clearState() {
        localStorage.removeItem(STORAGE_KEY);
    }
}

/* ==========================================================================
   UI CONTROLLER
   ========================================================================== */
class UIController {
    constructor() {
        this.dataService = new DataService();
        this.cacheDOM();
        this.bindEvents();
    }

    cacheDOM() {
        this.form = document.getElementById('calc-form');
        this.principalInput = document.getElementById('principal');
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

        this.resStartIndex = document.getElementById('res-start-index');
        this.resEndIndex = document.getElementById('res-end-index');
        this.resMultiplier = document.getElementById('res-multiplier');
        this.resDelayAmount = document.getElementById('res-delay-amount');
        this.resFinalAmount = document.getElementById('res-final-amount');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleCalculate(e));
        this.btnClear.addEventListener('click', () => this.clearForm());
        this.btnCopy.addEventListener('click', () => this.copyResults());
        this.principalInput.addEventListener('input', (e) => this.formatPrincipalInput(e));
    }

    async init() {
        const success = await this.dataService.loadIndices();
        this.loadingSpinner.classList.add('d-none');
        
        if (!success) {
            this.showError("خطا در دریافت اطلاعات شاخص‌ها از فایل. لطفاً دوباره تلاش کنید.");
            return;
        }

        this.calculatorCard.classList.remove('d-none');
        this.populateDropdowns();
        this.restoreState();
    }

    populateDropdowns() {
        const yearOptions = this.dataService.availableYears.map(year => 
            `<option value="${year}">${NumberUtils.formatCurrency(year)}</option>`
        ).join('');
        this.startYearSelect.innerHTML += yearOptions;
        this.endYearSelect.innerHTML += yearOptions;

        const monthOptions = PERSIAN_MONTHS.map(m => 
            `<option value="${m.value}">${m.name}</option>`
        ).join('');
        this.startMonthSelect.innerHTML += monthOptions;
        this.endMonthSelect.innerHTML += monthOptions;
    }

    formatPrincipalInput(e) {
        const rawValue = e.target.value;
        const number = NumberUtils.parseFloatStrict(rawValue);
        if (isNaN(number)) {
            e.target.value = '';
        } else {
            e.target.value = NumberUtils.formatCurrency(number);
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

        // Validation for null/missing indices
        if (startIndex === null) {
            const mName = PERSIAN_MONTHS.find(m=>m.value === startMonth).name;
            return this.showError(`شاخص بانک مرکزی برای تاریخ مبدأ (${mName} ${startYear}) هنوز اعلام نشده و یا نامعتبر است.`);
        }
        if (endIndex === null) {
            const mName = PERSIAN_MONTHS.find(m=>m.value === endMonth).name;
            return this.showError(`شاخص بانک مرکزی برای تاریخ مقصد (${mName} ${endYear}) هنوز اعلام نشده و یا نامعتبر است.`);
        }

        const results = Calculator.compute(principal, startIndex, endIndex);
        this.displayResults(startIndex, endIndex, results);

        StorageService.saveState({
            principal: this.principalInput.value,
            startYear, startMonth, endYear, endMonth
        });
    }

    displayResults(startIndex, endIndex, results) {
        this.resStartIndex.textContent = NumberUtils.formatDecimal(startIndex, 3);
        this.resEndIndex.textContent = NumberUtils.formatDecimal(endIndex, 3);
        this.resMultiplier.textContent = NumberUtils.formatDecimal(results.multiplier, 4);
        
        this.resDelayAmount.textContent = NumberUtils.formatCurrency(results.delayAmount);
        this.resFinalAmount.textContent = NumberUtils.formatCurrency(results.finalAmount);

        this.resultCard.classList.remove('d-none');
        this.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    clearForm() {
        this.form.reset();
        this.hideError();
        this.resultCard.classList.add('d-none');
        StorageService.clearState();
        this.principalInput.focus();
    }

    restoreState() {
        const state = StorageService.loadState();
        if (state) {
            if (state.principal) this.principalInput.value = state.principal;
            if (state.startYear) this.startYearSelect.value = state.startYear;
            if (state.startMonth) this.startMonthSelect.value = state.startMonth;
            if (state.endYear) this.endYearSelect.value = state.endYear;
            if (state.endMonth) this.endMonthSelect.value = state.endMonth;
        }
    }

    async copyResults() {
        const textToCopy = `محاسبه خسارت تأخیر تأدیه:
مبلغ اصل دین: ${this.principalInput.value}
تاریخ شروع: ${this.startMonthSelect.options[this.startMonthSelect.selectedIndex].text} ${this.startYearSelect.value} (شاخص: ${this.resStartIndex.textContent})
تاریخ پایان: ${this.endMonthSelect.options[this.endMonthSelect.selectedIndex].text} ${this.endYearSelect.value} (شاخص: ${this.resEndIndex.textContent})
ضریب تغییرات: ${this.resMultiplier.textContent}
مبلغ خسارت: ${this.resDelayAmount.textContent}
مبلغ نهایی (اصل + خسارت): ${this.resFinalAmount.textContent}
`;
        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = this.btnCopy.textContent;
            this.btnCopy.textContent = 'نتیجه کپی شد!';
            this.btnCopy.classList.add('btn-copied');
            
            setTimeout(() => {
                this.btnCopy.textContent = originalText;
                this.btnCopy.classList.remove('btn-copied');
            }, 2500);
        } catch (err) {
            alert('متأسفانه کپی کردن متن در مرورگر شما پشتیبانی نمی‌شود.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new UIController();
    app.init();
});