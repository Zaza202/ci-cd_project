// GCP instance pricing (per hour)
const instancePricing = {
    'e2-standard-2': 0.067012,
    'e2-standard-4': 0.134024,
    'n2-standard-2': 0.097014,
    'n2-standard-4': 0.194028
};

// Storage pricing (per GB per month)
const storagePricing = {
    'standard': 0.02,  // Standard persistent disk
    'ssd': 0.17,       // SSD persistent disk
    'network': 0.12    // Network storage
};

// API endpoints
const API_URL = '/api';

// DOM Elements
const billingForm = document.getElementById('billingForm');
const billingSummary = document.getElementById('billingSummary');
const billingHistory = document.getElementById('billingHistory');
const instanceTypeSelect = document.getElementById('instanceType');
const storageTypeSelect = document.getElementById('storageType');
const storageSizeInput = document.getElementById('storageSize');
const hoursInput = document.getElementById('hours');
const instanceCostElement = document.getElementById('instanceCost');
const storageCostElement = document.getElementById('storageCost');
const totalCostElement = document.getElementById('totalCost');

let instanceTypes = {};
let storageTypes = {};

// Fetch instance types and storage types
async function fetchTypes() {
    try {
        const [instanceTypesResponse, storageTypesResponse] = await Promise.all([
            fetch(`${API_URL}/instance-types`).then(res => res.json()),
            fetch(`${API_URL}/storage-types`).then(res => res.json())
        ]);

        instanceTypes = instanceTypesResponse;
        storageTypes = storageTypesResponse;

        // Populate instance type select
        instanceTypeSelect.innerHTML = '<option value="">Select an instance type</option>' +
            Object.entries(instanceTypes).map(([key, value]) => 
                `<option value="${key}">${value.name} (${value.cpu} vCPU, ${value.memory}GB RAM)</option>`
            ).join('');

        // Populate storage type select
        storageTypeSelect.innerHTML = '<option value="">Select storage type</option>' +
            Object.entries(storageTypes).map(([key, value]) => 
                `<option value="${key}">${key.charAt(0).toUpperCase() + key.slice(1)} ($${value}/GB/month)</option>`
            ).join('');
    } catch (error) {
        console.error('Error fetching types:', error);
        alert('Error loading instance and storage types. Please refresh the page.');
    }
}

// Calculate and display costs
function updateCosts() {
    const instanceType = instanceTypeSelect.value;
    const storageType = storageTypeSelect.value;
    const storageSize = parseFloat(storageSizeInput.value) || 0;
    const hours = parseFloat(hoursInput.value) || 0;

    // Debug log
    console.log('Selected instanceType:', instanceType);
    console.log('Available instancePricing keys:', Object.keys(instancePricing));

    if (!instanceType || !(instanceType in instancePricing)) {
        instanceCostElement.textContent = 'Instance Cost: $0.00';
        storageCostElement.textContent = 'Storage Cost: $0.00';
        totalCostElement.textContent = 'Total Cost: $0.00';
        return;
    }

    if (instanceType && storageType && storageSize && hours) {
        const instanceCost = instancePricing[instanceType] * hours;
        const storageCost = storagePricing[storageType] * storageSize * (hours / 730); // Convert to monthly rate
        const totalCost = instanceCost + storageCost;

        instanceCostElement.textContent = `Instance Cost: $${isNaN(instanceCost) ? '0.00' : instanceCost.toFixed(2)}`;
        storageCostElement.textContent = `Storage Cost: $${isNaN(storageCost) ? '0.00' : storageCost.toFixed(2)}`;
        totalCostElement.textContent = `Total Cost: $${isNaN(totalCost) ? '0.00' : totalCost.toFixed(2)}`;
    }
}

// Add event listeners for real-time cost updates
instanceTypeSelect.addEventListener('change', updateCosts);
storageTypeSelect.addEventListener('change', updateCosts);
storageSizeInput.addEventListener('input', updateCosts);
hoursInput.addEventListener('input', updateCosts);

// Fetch and display billing data
async function fetchBillingData() {
    try {
        const [bills, summary] = await Promise.all([
            fetch(`${API_URL}/billing`).then(res => res.json()),
            fetch(`${API_URL}/billing/summary`).then(res => res.json())
        ]);

        displayBillingHistory(bills);
        displayBillingSummary(summary);
    } catch (error) {
        console.error('Error fetching billing data:', error);
        alert('Error fetching billing data. Please try again.');
    }
}

// Display billing history
function displayBillingHistory(bills) {
    billingHistory.innerHTML = bills.map(bill => `
        <tr>
            <td>${instanceTypes[bill.instanceType]?.name || bill.instanceType}</td>
            <td>${bill.cpu}</td>
            <td>${bill.memory}</td>
            <td>${bill.storageType}</td>
            <td>${bill.storageSize}</td>
            <td>${bill.hours}</td>
            <td>$${bill.cost.toFixed(2)}</td>
            <td>${new Date(bill.date).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// Display billing summary
function displayBillingSummary(summary) {
    billingSummary.innerHTML = summary.map(item => `
        <div class="mb-3">
            <h6>${instanceTypes[item._id]?.name || item._id}</h6>
            <p>Total Cost: $${item.totalCost.toFixed(2)}</p>
            <p>Total Hours: ${item.totalHours}</p>
            <p>Total Storage: ${item.totalStorage} GB</p>
        </div>
    `).join('');
}

// Handle form submission
billingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const instanceType = instanceTypeSelect.value;
    const storageType = storageTypeSelect.value;
    const storageSize = parseFloat(storageSizeInput.value);
    const hours = parseFloat(hoursInput.value);

    if (!instanceType || !storageType || !storageSize || !hours) {
        alert('Please fill in all fields');
        return;
    }

    // Validate instance type
    if (!instancePricing[instanceType]) {
        alert('Invalid instance type selected');
        return;
    }

    const instanceCost = instancePricing[instanceType] * hours;
    const storageCost = storagePricing[storageType] * storageSize * (hours / 730);
    const totalCost = instanceCost + storageCost;

    const formData = {
        instanceType,
        storageType,
        storageSize,
        hours,
        cost: totalCost,
        date: new Date().toISOString()
    };

    try {
        const response = await fetch('/api/billing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to save calculation');
        }

        // Reset form and update display
        billingForm.reset();
        instanceCostElement.textContent = 'Instance Cost: $0.00';
        storageCostElement.textContent = 'Storage Cost: $0.00';
        totalCostElement.textContent = 'Total Cost: $0.00';
        
        // Reload billing history
        await loadBillingHistory();
        
        alert('Calculation saved successfully!');
    } catch (error) {
        console.error('Error saving calculation:', error);
        alert(error.message || 'Error saving calculation. Please try again.');
    }
});

// Load billing history
async function loadBillingHistory() {
    try {
        const response = await fetch('/api/billing');
        const billingEntries = await response.json();
        
        billingHistory.innerHTML = billingEntries.map(entry => `
            <tr>
                <td>${entry.instanceType}</td>
                <td>${entry.cpu}</td>
                <td>${entry.memory}</td>
                <td>${entry.storageType}</td>
                <td>${entry.storageSize}</td>
                <td>${entry.hours}</td>
                <td>$${entry.cost.toFixed(2)}</td>
                <td>${new Date(entry.date).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        billingHistory.innerHTML = '<tr><td colspan="8" class="text-center">Error loading billing history</td></tr>';
    }
}

// Initial load
fetchTypes();
fetchBillingData();
loadBillingHistory(); 