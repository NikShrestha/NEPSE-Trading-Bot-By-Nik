import fs from 'fs';
import fetch from 'node-fetch';

// ==========================================
// 🔴 ENTER YOUR TELEGRAM DETAILS HERE 🔴
// ==========================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8626490950:AAE331dJW8upggikCI4Nu2NJpbbjA9ufcFg';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5612804722';

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    tickMs: 5000, // Update every 5 seconds
    saveMs: 30000, // Auto-save every 30 seconds
    fee: { sebon: 0.00015, dp: 25 },
    tax: { shortTerm: 0.075, longTerm: 0.05 },
    dbFile: './nepse_database.json'
};

const SECTORS = {
    BANK: "Commercial Bank", HYDRO: "Hydropower",
    LIFE: "Life Insurance", MICRO: "Microfinance", TELECOM: "Telecom"
};

const STOCK_UNIVERSE = [
    { sym: "NABIL", sec: SECTORS.BANK, cls: "A", base: 1190, vol: 0.015 },
    { sym: "NICA",  sec: SECTORS.BANK, cls: "A", base: 850,  vol: 0.015 },
    { sym: "EBL",   sec: SECTORS.BANK, cls: "A", base: 600,  vol: 0.012 },
    { sym: "PRVU",  sec: SECTORS.BANK, cls: "A", base: 450,  vol: 0.018 },
    { sym: "UPPER", sec: SECTORS.HYDRO, cls: "A", base: 650, vol: 0.035 },
    { sym: "CHCL",  sec: SECTORS.HYDRO, cls: "B", base: 400, vol: 0.03 },
    { sym: "NHPC",  sec: SECTORS.HYDRO, cls: "B", base: 200, vol: 0.04 },
    { sym: "NLICL", sec: SECTORS.LIFE,  cls: "A", base: 1200, vol: 0.02 },
    { sym: "CBBL",  sec: SECTORS.MICRO, cls: "A", base: 1500, vol: 0.045 },
    { sym: "SKBBL", sec: SECTORS.MICRO, cls: "A", base: 2100, vol: 0.05 },
    { sym: "NTC",   sec: SECTORS.TELECOM, cls: "A", base: 950, vol: 0.01 }
];

let STATE = {
    simDayTracker: 0,
    nepseIndex: 2100,
    bots: {
        bot1: { id: "bot1", name: "🛡️ Sentinel", port: 10000, cash: 10000, positions: [], wins: 0, losses: 0, fees: 0 },
        bot2: { id: "bot2", name: "💧 Hydro Hawk", port: 10000, cash: 10000, positions: [], wins: 0, losses: 0, fees: 0 },
        bot3: { id: "bot3", name: "💰 Dividend", port: 10000, cash: 10000, positions: [], wins: 0, losses: 0, fees: 0 },
        bot4: { id: "bot4", name: "👑 Apex NEPSE", port: 10000, cash: 10000, positions: [], wins: 0, losses: 0, fees: 0 }
    },
    marketData: {}
};

// ==========================================
// TELEGRAM INTEGRATION
// ==========================================
async function sendTelegram(message) {
    if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
        console.log("MOCK TELEGRAM:", message.replace(/<[^>]+>/g, ''));
        return;
    }
    
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: TELEGRAM_CHAT_ID, 
                text: message, 
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch (e) {
        console.error("Telegram send failed:", e.message);
    }
}

// ==========================================
// UTILS & DB
// ==========================================
const formatNPR = (val) => 'रू ' + val.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function loadDatabase() {
    if (fs.existsSync(CONFIG.dbFile)) {
        console.log("💾 Loading previous session from database...");
        STATE = JSON.parse(fs.readFileSync(CONFIG.dbFile, 'utf8'));
        sendTelegram("🔄 <b>NEPSE Bot Simulator Re-started!</b>\nRestored your previous balances and positions.");
    } else {
        console.log("🆕 Starting fresh session...");
        initMarketData();
        sendTelegram("✅ <b>NEPSE Bot Simulator Started!</b>\nAll 4 bots are now scanning the market 24/7. Waiting for signals...");
    }
}

function saveDatabase() {
    fs.writeFileSync(CONFIG.dbFile, JSON.stringify(STATE, null, 2));
}

function calcBuyFees(value) {
    let commission = value <= 50000 ? value * 0.004 : value <= 500000 ? value * 0.0037 : value <= 2000000 ? value * 0.0034 : value * 0.003;
    return commission + (value * CONFIG.fee.sebon) + CONFIG.fee.dp;
}

function calcSellFees(value, profit, daysHeld) {
    let baseFees = calcBuyFees(value);
    let cgt = profit > 0 ? (daysHeld < 365 ? profit * CONFIG.tax.shortTerm : profit * CONFIG.tax.longTerm) : 0;
    return baseFees + cgt;
}

// ==========================================
// SIMULATION ENGINE
// ==========================================
function initMarketData() {
    STOCK_UNIVERSE.forEach(s => {
        let hist = [];
        let cur = s.base;
        for(let i=0; i<60; i++) { cur = cur * (1 + (Math.random() - 0.5) * s.vol); hist.push(cur); }
        STATE.marketData[s.sym] = {
            sym: s.sym, sec: s.sec, cls: s.cls,
            current: hist[hist.length-1], prevClose: hist[hist.length-1],
            history: hist, volBase: s.vol, circuit: "NONE"
        };
    });
}

function tickMarket() {
    let totalChg = 0;
    Object.keys(STATE.marketData).forEach(sym => {
        let md = STATE.marketData[sym];
        let change = (Math.random() - 0.48) * md.volBase;
        let newPrice = md.current * (1 + change);

        let maxUp = md.prevClose * 1.10;
        let maxDown = md.prevClose * 0.90;
        md.circuit = "NONE";
        if(newPrice >= maxUp) { newPrice = maxUp; md.circuit = "UC"; }
        if(newPrice <= maxDown) { newPrice = maxDown; md.circuit = "LC"; }

        md.current = newPrice;
        totalChg += change;
    });

    STATE.nepseIndex = STATE.nepseIndex * (1 + (totalChg / STOCK_UNIVERSE.length) * 0.8);
    
    // Simulate end of day passing
    if(Math.random() < 0.1) {
        STATE.simDayTracker++;
        let settledThisTick = [];

        Object.keys(STATE.marketData).forEach(sym => {
            let md = STATE.marketData[sym];
            md.history.push(md.current);
            if(md.history.length > 60) md.history.shift();
            md.prevClose = md.current;
        });

        // Check for T+2 settlements
        ['bot1', 'bot2', 'bot3', 'bot4'].forEach(b => {
            STATE.bots[b].positions.forEach(p => {
                if ((STATE.simDayTracker - p.entryDay) === 2) {
                    settledThisTick.push(`• ${p.kitta} Kitta of ${p.sym} for ${STATE.bots[b].name}`);
                }
            });
        });

        if (settledThisTick.length > 0) {
            sendTelegram(`⏱ <b>T+2 Settlement Cleared!</b>\nThe following shares are now available to sell:\n${settledThisTick.join('\n')}`);
        }
    }
}

// ==========================================
// TECHNICAL INDICATORS
// ==========================================
function getIndicators(sym) {
    let md = STATE.marketData[sym];
    let h = md.history;
    if(h.length < 26) return null;

    let ema = (data, periods) => {
        let k = 2 / (periods + 1);
        let res = [data[0]];
        for(let i=1; i<data.length; i++) res.push(data[i] * k + res[i-1] * (1 - k));
        return res[res.length-1];
    };

    let rsi = (data, periods=14) => {
        let gains=0, losses=0;
        for(let i=data.length-periods; i<data.length; i++){
            let diff = data[i] - data[i-1];
            if(diff>0) gains+=diff; else losses-=diff;
        }
        let rs = (gains/periods) / (losses/periods == 0 ? 1 : losses/periods);
        return 100 - (100 / (1 + rs));
    };

    return { 
        ema9: ema(h, 9), ema21: ema(h, 21), 
        rsi14: rsi(h, 14), macdLine: ema(h, 12) - ema(h, 26), 
        cur: md.current, circuit: md.circuit, cls: md.cls, sec: md.sec 
    };
}

// ==========================================
// TRADE EXECUTION & ALERTS
// ==========================================
function executeTrade(botId, type, sym, kitta, price, reason) {
    let bot = STATE.bots[botId];
    let val = kitta * price;
    
    if(type === 'BUY') {
        let fees = calcBuyFees(val);
        let totalCost = val + fees;
        if(bot.cash >= totalCost) {
            bot.cash -= totalCost;
            bot.fees += fees;
            bot.positions.push({ sym, kitta, entry: price, val, entryDay: STATE.simDayTracker, feesPaid: fees });
            
            let msg = `🟢 <b>NEW BUY TRIGGERED</b> 🟢\n\n`;
            msg += `<b>Bot:</b> ${bot.name}\n`;
            msg += `<b>Stock:</b> ${sym} (${kitta} Kitta)\n`;
            msg += `<b>Price:</b> ${formatNPR(price)}\n`;
            msg += `<b>Cost:</b> ${formatNPR(val)}\n`;
            msg += `<b>Taxes & Fees Paid:</b> ${formatNPR(fees)}\n\n`;
            msg += `<b>🧠 Bot Reasoning:</b>\n<i>${reason}</i>\n\n`;
            msg += `<i>Note: Shares will clear T+2 settlement in 2 trading days before they can be sold.</i>`;
            
            sendTelegram(msg);
            console.log(`[BUY] ${bot.name} -> ${sym}`);
        }
    } else {
        let posIdx = bot.positions.findIndex(p => p.sym === sym);
        if(posIdx > -1) {
            let pos = bot.positions[posIdx];
            let gross = val - pos.val;
            let daysHeld = STATE.simDayTracker - pos.entryDay;
            let fees = calcSellFees(val, gross, daysHeld);
            let net = gross - fees - pos.feesPaid;
            
            bot.cash += (val - fees);
            bot.fees += fees;
            if(net > 0) bot.wins++; else bot.losses++;
            bot.positions.splice(posIdx, 1);
            
            let emoji = net >= 0 ? '✅' : '🚨';
            let msg = `${emoji} <b>POSITION CLOSED</b> ${emoji}\n\n`;
            msg += `<b>Bot:</b> ${bot.name}\n`;
            msg += `<b>Stock:</b> ${sym} (${kitta} Kitta)\n`;
            msg += `<b>Entry Price:</b> ${formatNPR(pos.entry)}\n`;
            msg += `<b>Exit Price:</b> ${formatNPR(price)}\n\n`;
            msg += `<b>Net P&L:</b> ${net >= 0 ? '+' : ''}${formatNPR(net)}\n`;
            msg += `<b>Taxes & Fees Paid:</b> ${formatNPR(fees + pos.feesPaid)}\n`;
            msg += `<b>Days Held:</b> ${daysHeld} days\n\n`;
            msg += `<b>🧠 Bot Reasoning:</b>\n<i>${reason}</i>`;
            
            sendTelegram(msg);
            console.log(`[SELL] ${bot.name} -> ${sym} (P&L: ${net})`);
        }
    }
}

// ==========================================
// BOT STRATEGIES
// ==========================================
function evalBots() {
    // 🛡️ SENTINEL
    let bot1 = STATE.bots.bot1;
    [...bot1.positions].forEach(p => {
        if((STATE.simDayTracker - p.entryDay) < 2) return;
        let md = STATE.marketData[p.sym];
        let ind = getIndicators(p.sym);
        let chg = (md.current - p.entry) / p.entry;
        if(chg >= 0.06 || ind.rsi14 > 65) executeTrade('bot1', 'SELL', p.sym, p.kitta, md.current, "Target profit reached (+6%) or RSI became overbought. Securing gains.");
        else if(chg <= -0.04) executeTrade('bot1', 'SELL', p.sym, p.kitta, md.current, "Stop loss triggered (-4%). Cutting losses early to protect capital.");
    });
    if(bot1.positions.length < 4) {
        for(let sym of Object.keys(STATE.marketData)) {
            let ind = getIndicators(sym);
            if(ind && ind.cls === "A" && ind.circuit !== "UC" && ind.rsi14 < 35 && !bot1.positions.find(p=>p.sym===sym)) {
                let kitta = Math.floor((bot1.cash * 0.20) / ind.cur);
                if(kitta > 0) executeTrade('bot1', 'BUY', sym, kitta, ind.cur, `Classic value bounce setup. RSI dropped to ${ind.rsi14.toFixed(1)} meaning this Class A stock is heavily oversold. Buying the dip.`);
                break;
            }
        }
    }

    // 💧 HYDRO HAWK
    let bot2 = STATE.bots.bot2;
    [...bot2.positions].forEach(p => {
        if((STATE.simDayTracker - p.entryDay) < 2) return;
        let md = STATE.marketData[p.sym];
        let ind = getIndicators(p.sym);
        if(ind.ema9 < ind.ema21) executeTrade('bot2', 'SELL', p.sym, p.kitta, md.current, "Momentum shift: Fast moving average (EMA9) crossed below slow moving average (EMA21). Trend is reversing.");
        else if((md.current - p.entry)/p.entry <= -0.05) executeTrade('bot2', 'SELL', p.sym, p.kitta, md.current, "Hard stop loss (-5%) hit for volatile hydro sector.");
    });
    if(bot2.positions.length < 5) {
        for(let sym of Object.keys(STATE.marketData)) {
            let ind = getIndicators(sym);
            if(ind && ind.sec === SECTORS.HYDRO && ind.circuit !== "UC" && ind.ema9 > ind.ema21 && ind.macdLine > 0 && ind.rsi14 < 65 && !bot2.positions.find(p=>p.sym===sym)) {
                let kitta = Math.floor((bot2.cash * 0.15) / ind.cur);
                if(kitta > 0) executeTrade('bot2', 'BUY', sym, kitta, ind.cur, "Hydro Sector Momentum: Both EMA and MACD are flashing bullish signals. Sector money is flowing in.");
                break;
            }
        }
    }

    // 💰 DIVIDEND
    let bot3 = STATE.bots.bot3;
    [...bot3.positions].forEach(p => {
        if((STATE.simDayTracker - p.entryDay) < 2) return;
        let md = STATE.marketData[p.sym];
        let ind = getIndicators(p.sym);
        if(ind.rsi14 > 70) executeTrade('bot3', 'SELL', p.sym, p.kitta, md.current, "Dividend stock became technically overbought. Capturing capital gains instead of waiting for dividend.");
        else if((md.current - p.entry)/p.entry <= -0.08) executeTrade('bot3', 'SELL', p.sym, p.kitta, md.current, "Structural breakdown of dividend stock (-8%). Exiting.");
    });
    if(bot3.positions.length < 4) {
        for(let sym of Object.keys(STATE.marketData)) {
            let ind = getIndicators(sym);
            if(ind && ind.cls === "A" && ind.circuit !== "UC" && ind.rsi14 < 40 && !bot3.positions.find(p=>p.sym===sym)) {
                let kitta = Math.floor((bot3.cash * 0.20) / ind.cur);
                if(kitta > 0) executeTrade('bot3', 'BUY', sym, kitta, ind.cur, "Accumulating high-quality Class A stock for upcoming book closures / dividends at a discount (RSI < 40).");
                break;
            }
        }
    }

    // 👑 APEX NEPSE
    let bot4 = STATE.bots.bot4;
    [...bot4.positions].forEach(p => {
        if((STATE.simDayTracker - p.entryDay) < 2) return;
        let md = STATE.marketData[p.sym];
        let chg = (md.current - p.entry)/p.entry;
        if(chg >= 0.05) executeTrade('bot4', 'SELL', p.sym, p.kitta, md.current, "Strict +5% target hit. Apex bot secures profit immediately.");
        else if(chg <= -0.03) executeTrade('bot4', 'SELL', p.sym, p.kitta, md.current, "Strict -3% risk limit hit. Apex bot cuts losses immediately.");
    });
    if(bot4.positions.length < 3) {
        for(let sym of Object.keys(STATE.marketData)) {
            let ind = getIndicators(sym);
            if(ind && ind.cls === "A" && ind.circuit === "NONE" && ind.rsi14 >= 30 && ind.rsi14 <= 45 && ind.ema9 > ind.ema21 && ind.macdLine > 0 && !bot4.positions.find(p=>p.sym===sym)) {
                let kitta = Math.floor((bot4.cash * 0.15) / ind.cur);
                if(kitta > 0) executeTrade('bot4', 'BUY', sym, kitta, ind.cur, "100/100 Perfect Setup: Stock is recovering from oversold (RSI 30-45), MACD is positive, EMA is bullish, and it's a Class A safe stock.");
                break;
            }
        }
    }
}

// ==========================================
// START ENGINE
// ==========================================
loadDatabase();

// Run market tick and bot logic every 5 seconds
setInterval(() => {
    tickMarket();
    evalBots();
}, CONFIG.tickMs);

// Save database to disk every 30 seconds
setInterval(() => {
    saveDatabase();
}, CONFIG.saveMs);

// Portfolio Summary to Telegram every 2 hours (120 * 60 * 1000)
setInterval(() => {
    let tPort = 0, openPos = 0;
    ['bot1', 'bot2', 'bot3', 'bot4'].forEach(b => {
        let bVal = STATE.bots[b].cash;
        STATE.bots[b].positions.forEach(p => { 
            bVal += (p.kitta * STATE.marketData[p.sym].current); 
            openPos++;
        });
        tPort += bVal;
    });
    
    let net = tPort - 40000;
    let icon = net >= 0 ? '📈' : '📉';
    let msg = `${icon} <b>DAILY PORTFOLIO SUMMARY</b> ${icon}\n\n`;
    msg += `<b>Total Value:</b> ${formatNPR(tPort)}\n`;
    msg += `<b>Total Profit/Loss:</b> ${net >= 0 ? '+' : ''}${formatNPR(net)}\n`;
    msg += `<b>Active Positions:</b> ${openPos}\n`;
    msg += `<b>NEPSE Index:</b> ${STATE.nepseIndex.toFixed(2)}\n\n`;
    msg += `<i>The bots are monitoring the market...</i>`;
    sendTelegram(msg);
}, 2 * 60 * 60 * 1000);

console.log("🚀 NEPSE Backend Engine is running! Press Ctrl+C to stop.");
