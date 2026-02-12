/* ========================= */
/* CONFIG */
/* ========================= */

let TOKEN_ADDRESS = null;
let SHOP_ADDRESS = null;

const ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

let provider = null;
let signer = null;
let token = null;
let userAddress = null;

let cart = [];
let history = [];
let isConnected = false;

/* ========================= */
/* HELPER */
/* ========================= */

function getHistoryKey() {
  if (!TOKEN_ADDRESS || !userAddress) return null;
  return `history_${TOKEN_ADDRESS}_${userAddress}`;
}

/* ========================= */
/* INITIAL LOAD */
/* ========================= */

window.addEventListener("load", async () => {

  document.getElementById("disconnectBtn").classList.add("hidden");

  const savedToken = localStorage.getItem("tokenAddress");
  const savedShop = localStorage.getItem("shopAddress");

  if (!savedToken || !savedShop || !window.ethereum) {
    updateHistory();
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_accounts", []);
    if (accounts.length === 0) return;

    TOKEN_ADDRESS = savedToken;
    SHOP_ADDRESS = savedShop;

    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    token = new ethers.Contract(TOKEN_ADDRESS, ABI, signer);

    isConnected = true;

    const key = getHistoryKey();
    history = JSON.parse(localStorage.getItem(key)) || [];

    const connectBtn = document.getElementById("connectBtn");
    connectBtn.innerHTML =
      `<span class="flex items-center gap-2">
        <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        เชื่อมต่อแล้ว
      </span>`;
    connectBtn.disabled = true;

    document.getElementById("disconnectBtn").classList.remove("hidden");

    getBalance();
    updateHistory();

  } catch (err) {
    console.log("Reconnect failed");
  }
});

/* ========================= */
/* CONNECT */
/* ========================= */

document.getElementById("connectBtn").addEventListener("click", connectWallet);
document.getElementById("disconnectBtn").addEventListener("click", disconnectWallet);

async function connectWallet() {

  if (isConnected) {
    Swal.fire("เชื่อมต่อแล้ว", "กรุณากดออกจากระบบก่อน", "info");
    return;
  }

  if (!window.ethereum) {
    Swal.fire("Error", "กรุณาติดตั้ง MetaMask", "error");
    return;
  }

  const { value: formValues } = await Swal.fire({
    title: "ตั้งค่า Token",
    html:
      '<input id="swal-token" class="swal2-input" placeholder="Token Address">' +
      '<input id="swal-shop" class="swal2-input" placeholder="Shop Address">',
    showCancelButton: true,
    confirmButtonText: "เชื่อมต่อ",
    preConfirm: () => {
      const tokenAddr = document.getElementById('swal-token').value.trim();
      const shopAddr = document.getElementById('swal-shop').value.trim();

      if (!ethers.isAddress(tokenAddr) || !ethers.isAddress(shopAddr)) {
        Swal.showValidationMessage("กรุณาใส่ Address ให้ถูกต้อง");
        return false;
      }

      return { token: tokenAddr, shop: shopAddr };
    }
  });

  if (!formValues) return;

  TOKEN_ADDRESS = formValues.token;
  SHOP_ADDRESS = formValues.shop;

  provider = new ethers.BrowserProvider(window.ethereum);

  await window.ethereum.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }]
  });

  await window.ethereum.request({
    method: "eth_requestAccounts"
  });

  signer = await provider.getSigner();
  userAddress = await signer.getAddress();
  token = new ethers.Contract(TOKEN_ADDRESS, ABI, signer);

  localStorage.setItem("tokenAddress", TOKEN_ADDRESS);
  localStorage.setItem("shopAddress", SHOP_ADDRESS);

  isConnected = true;

  const connectBtn = document.getElementById("connectBtn");
  connectBtn.innerHTML =
    `<span class="flex items-center gap-2">
      <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
      เชื่อมต่อแล้ว
    </span>`;
  connectBtn.disabled = true;

  document.getElementById("disconnectBtn").classList.remove("hidden");

  const key = getHistoryKey();
  history = JSON.parse(localStorage.getItem(key)) || [];

  Swal.fire("สำเร็จ!", "เชื่อมต่อ Wallet แล้ว", "success");

  getBalance();
  updateHistory();
}

/* ========================= */
/* DISCONNECT */
/* ========================= */

function disconnectWallet() {

  provider = null;
  signer = null;
  token = null;
  userAddress = null;
  TOKEN_ADDRESS = null;
  SHOP_ADDRESS = null;

  cart = [];
  history = [];
  isConnected = false;

  updateCart();
  updateHistory();

  const connectBtn = document.getElementById("connectBtn");
  connectBtn.innerText = "เชื่อมต่อกระเป๋าตังค์";
  connectBtn.disabled = false;

  document.getElementById("balance").innerText = "0";
  document.getElementById("disconnectBtn").classList.add("hidden");

  localStorage.removeItem("tokenAddress");
  localStorage.removeItem("shopAddress");

  Swal.fire("ออกจากระบบแล้ว", "", "info");
}

/* ========================= */
/* BALANCE */
/* ========================= */

async function getBalance() {
  if (!token || !userAddress) return;

  const decimals = await token.decimals();
  const balance = await token.balanceOf(userAddress);

  document.getElementById("balance").innerText =
    ethers.formatUnits(balance, decimals);
}

/* ========================= */
/* CART */
/* ========================= */

function addToCart(name, price) {

  if (!isConnected) {
    Swal.fire("กรุณา เชื่อมต่อกระเป๋าตังค์ ก่อน", "", "warning");
    return;
  }

  cart.push({ name, price });
  updateCart();
}

function clearCart() {

  if (!isConnected) {
    Swal.fire("กรุณา เชื่อมต่อกระเป๋าตังค์ ก่อน", "", "warning");
    return;
  }

  cart = [];
  updateCart();
}

function updateCart() {

  const cartList = document.getElementById("cartList");
  const totalEl = document.getElementById("total");

  if (cart.length === 0) {
    cartList.innerHTML =
      '<li class="text-slate-500 text-sm italic text-center py-4">ยังไม่มีสินค้าในตะกร้า</li>';
    totalEl.textContent = "0";
    return;
  }

  cartList.innerHTML = cart.map(item => `
    <li class="flex justify-between items-center bg-slate-800/50 rounded-lg px-3 py-2">
      <span class="text-sm">${item.name}</span>
      <span class=" font-semibold">${item.price}</span>
    </li>
  `).join("");

  totalEl.textContent =
    cart.reduce((sum, item) => sum + item.price, 0);
}

/* ========================= */
/* CHECKOUT */
/* ========================= */

async function checkout() {

  if (!isConnected) {
    Swal.fire("กรุณา เชื่อมต่อกระเป๋าตังค์ ก่อน", "", "warning");
    return;
  }

  if (cart.length === 0) {
    Swal.fire("ตะกร้าว่าง", "", "warning");
    return;
  }

  try {

    const total =
      cart.reduce((sum, item) => sum + item.price, 0);

    const decimals = await token.decimals();
    const amount =
      ethers.parseUnits(total.toString(), decimals);

    Swal.fire({
      title: "กำลังทำรายการ...",
      text: "กรุณายืนยันธุรกรรมใน MetaMask",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    const tx = await token.transfer(SHOP_ADDRESS, amount);

    Swal.update({
      title: "กำลังรอยืนยันธุรกรรม...",
      text: "รอการยืนยันจาก Blockchain"
    });

    await tx.wait();

    history.unshift({
      items: cart.map(c => c.name),
      total: total,
      date: new Date().toLocaleString("th-TH")
    });

    const key = getHistoryKey();
    localStorage.setItem(key, JSON.stringify(history));

    cart = [];
    updateCart();
    updateHistory();
    getBalance();

    Swal.fire("สำเร็จ!", "ชำระเงินเรียบร้อย 🎉", "success");

  } catch (err) {
    Swal.fire("ผิดพลาด", "ธุรกรรมล้มเหลว", "error");
  }
}

/* ========================= */
/* HISTORY */
/* ========================= */

function updateHistory() {

  const historyList = document.getElementById("historyList");

  if (history.length === 0) {
    historyList.innerHTML =
      '<li class="text-slate-500 text-sm italic text-center py-4">ยังไม่มีประวัติการซื้อ</li>';
    return;
  }

  historyList.innerHTML = history.map(p => `
    <li class="bg-slate-800/50 rounded-lg px-3 py-2">
      <div class="flex justify-between text-xs text-slate-400">
        <span>รายการสินค้า ${p.date}</span>
        <span class="text-green-400">-${p.total} บาท</span>
      </div>
      <div class="text-xs text-slate-500">
        ${p.items.join(", ")}
      </div>
    </li>
  `).join("");
}
