// Load rankings on start
window.onload = async () => {
    try {
        const res = await fetch("http://localhost:3000/rankings");
        const data = await res.json();

        const formatList = (list) => list.map(c => `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;">
                <span>${c.name}</span>
                <span style="color:#64748b">${c.index}</span>
            </div>
        `).join('');

        document.getElementById('expensive-list').innerHTML = formatList(data.expensive);
        document.getElementById('cheapest-list').innerHTML = formatList(data.cheapest);
    } catch (e) {
        document.getElementById('expensive-list').innerText = "Failed to load.";
        document.getElementById('cheapest-list').innerText = "Failed to load.";
    }
};

async function fetchData() {
    const city = document.getElementById('city').value;
    const salary = document.getElementById('salary').value;
    const loader = document.getElementById('loader');
    const screen = document.getElementById('verdict-screen');

    if (!city || !salary) return;

    loader.classList.remove('hidden');
    screen.classList.add('hidden');

    try {
        const res = await fetch(`http://localhost:3000/city/${city}`);
        const data = await res.json();

        render(data, salary);
    } catch (err) {
        console.error(err);
        alert("API Error! Port 3000?");
    } finally {
        loader.classList.add('hidden');
    }
}


function render(data, salary) {
    const container = document.getElementById('items');
    const suggestionsContainer = document.getElementById('suggestions');
    container.innerHTML = '';
    suggestionsContainer.innerHTML = '';

    let housingCost = 0;
    let foodCost = 0;
    let transportCost = 0;
    let otherCost = 0;

    // Helper to find price
    const getPrice = (namePart) => {
        const item = data.costs.find(c => c.item.toLowerCase().includes(namePart.toLowerCase()));
        return item ? (parseFloat(item.cost.replace(/[^0-9.]/g, '')) || 0) : 0;
    };

    // --- 1. Housing & Utilities ---
    const rent = getPrice('Apartment (1 bedroom) in City Centre');
    const utilities = getPrice('Basic (Electricity, Heating, Cooling, Water, Garbage)');
    const internet = getPrice('Internet (60 Mbps or More, Unlimited Data, Cable/ADSL)');
    housingCost = rent + utilities + internet;

    // --- 2. Transportation ---
    const transport = getPrice('Monthly Pass');
    transportCost = transport;

    // --- 3. Food (Resident Mode) ---
    // Standard Grocery Basket (Monthly for 1 person)
    const milk = getPrice('Milk (regular), (1 liter)') * 4;
    const bread = getPrice('Loaf of Fresh White Bread (500g)') * 2;
    const rice = getPrice('Rice (white), (1kg)') * 1;
    const eggs = getPrice('Eggs (regular) (12)') * 1;
    const cheese = getPrice('Local Cheese (1kg)') * 0.5; // Half kg
    const chicken = getPrice('Chicken Fillets (1kg)') * 2;
    const beef = getPrice('Beef Round (1kg)') * 0.5; // Half kg
    const fruits = (getPrice('Apples') + getPrice('Banana') + getPrice('Oranges')) * 1; // 1kg each
    const veg = (getPrice('Tomato') + getPrice('Potato') + getPrice('Onion')) * 1; // 1kg each

    // Dining Out (Twice a month inexpensive, once a month mid-range?)
    // Let's stick to user request: "Resident Mode" -> mostly groceries, occasional eating out.
    // 4x Inexpensive Meal (Once a week)
    const diningOut = getPrice('Meal, Inexpensive Restaurant') * 4;

    foodCost = milk + bread + rice + eggs + cheese + chicken + beef + fruits + veg + diningOut;

    // --- 4. Total Cost ---
    const total = housingCost + foodCost + transportCost;

    // --- Render Items ---
    const renderItem = (label, value) => {
        if (value > 0) {
            container.innerHTML += `
            <div class="expense-item">
                <span>${label}</span>
                <span class="price">$${value.toFixed(2)}</span>
            </div>`;
        }
    };

    renderItem('Housing (Rent + Utils)', housingCost);
    renderItem('Food (Groceries + Dining)', foodCost);
    renderItem('Transport', transportCost);

    // --- Render Verdict ---
    const diff = salary - total;
    const leftoverEl = document.getElementById('leftover');

    leftoverEl.innerText = `${diff < 0 ? '-' : ''}$${Math.abs(diff.toFixed(2))}`;
    leftoverEl.style.color = diff < 0 ? 'var(--danger)' : 'var(--success)';

    document.getElementById('summary').innerText = diff < 0
        ? `Estimated monthly costs: $${total.toFixed(0)}. You are in deficit.`
        : `Estimated monthly costs: $${total.toFixed(0)}. Sustainable.`;

    // --- Render Suggestions ---
    const addSuggestion = (text, type = 'neutral') => {
        const color = type === 'good' ? 'var(--success)' : type === 'bad' ? 'var(--danger)' : '#94a3b8';
        const icon = type === 'good' ? '✅' : type === 'bad' ? '⚠️' : 'ℹ️';
        suggestionsContainer.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border-left: 3px solid ${color}; display: flex; align-items: center; gap: 10px;">
                <span>${icon}</span>
                <span style="font-size: 0.9rem; color: #e2e8f0;">${text}</span>
            </div>
        `;
    };

    // 1. Solvency & Deficit Recovery
    if (diff >= 0) {
        // SURPLUS SCENARIOS
        const savingsRatio = (diff / salary) * 100;
        addSuggestion(`Potential Savings: ${savingsRatio.toFixed(0)}%. You can build wealth here.`, 'good');

        // Standard Ratios for Surplus
        const housingRatio = (housingCost / salary) * 100;
        if (housingRatio > 30) addSuggestion(`Housing is ${housingRatio.toFixed(0)}% of income (Ideal < 30%).`, 'neutral');
        else addSuggestion(`Housing is safe at ${housingRatio.toFixed(0)}% of income.`, 'good');

    } else {
        // DEFICIT SCENARIOS
        addSuggestion(`Current Deficit: -$${Math.abs(diff).toFixed(0)}/mo. You cannot live comfortably with current choices.`, 'bad');

        let possibleSavings = 0;
        let recoveryPlan = [];

        // Check Rent Savings (City Centre vs Outside)
        const rentOutside = getPrice('Apartment (1 bedroom) Outside of Centre');
        const rentSavings = rent - rentOutside;

        if (rentSavings > 0) {
            const newDiff = diff + rentSavings;
            if (newDiff > 0) {
                addSuggestion(`MOVE OUT: Renting "Outside City Centre" saves $${rentSavings.toFixed(0)}/mo. This alone fixes your budget! (Surplus: $${newDiff.toFixed(0)})`, 'good');
            } else {
                addSuggestion(`MOVE OUT: Renting "Outside City Centre" saves $${rentSavings.toFixed(0)}/mo. It helps, but you need more changes.`, 'neutral');
            }
        }

        // Check Dining Savings
        if (diningOut > 0) {
            const newDiff = diff + diningOut;
            if (newDiff > 0) {
                addSuggestion(`COOK MORE: Cutting the 4 restaurant meals/mo saves $${diningOut.toFixed(0)}. You'd be profitable!`, 'good');
            } else {
                addSuggestion(`COOK MORE: Cooking every meal saves $${diningOut.toFixed(0)}.`, 'neutral');
            }
        }

        // Check Transport Savings (Walk/Bike)
        if (transportCost > 0) {
            addSuggestion(`WALK/BIKE: Ditching the monthly pass saves $${transportCost.toFixed(0)}.`, 'neutral');
        }

        // Combined "Survival Mode" check
        const survivalDiff = diff + rentSavings + diningOut + transportCost;
        if (survivalDiff > 0) {
            addSuggestion(`SURVIVAL MODE: If you Move Outside (${rentSavings.toFixed(0)}) + Cook Only (${diningOut.toFixed(0)}) + Walk (${transportCost.toFixed(0)}), you can save $${survivalDiff.toFixed(0)}/mo.`, 'good');
        } else {
            addSuggestion(`CRITICAL: Even with cheapest housing and strict lifestyle, you are short by $${Math.abs(survivalDiff).toFixed(0)}. You need a higher salary or a cheaper city.`, 'bad');
        }
    }

    // 2. Food Ratio Context (Always show)
    const foodRatio = (foodCost / salary) * 100;
    if (foodRatio > 30) {
        addSuggestion(`Food is ${foodRatio.toFixed(0)}% of your income. High.`, 'neutral');
    }

    document.getElementById('verdict-screen').classList.remove('hidden');
}