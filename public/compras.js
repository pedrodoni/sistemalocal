import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =============================
   LOGIN
============================= */
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "login.html";
  }
});

/* =============================
   ELEMENTOS
============================= */
const distribuidorInput = document.getElementById("distribuidor");
const fechaInput = document.getElementById("fecha");
const montoInput = document.getElementById("monto");
const lista = document.getElementById("listaCompras");
const totalSpan = document.getElementById("total");

const comprasRef = collection(db, "compras");

/* =============================
   GUARDAR COMPRA
============================= */
document.getElementById("guardar").onclick = async () => {
  const distribuidor = distribuidorInput.value.trim();
  const fecha = fechaInput.value;
  const monto = Number(montoInput.value);

  if (!distribuidor || !fecha || monto <= 0) return;

  await addDoc(comprasRef, {
    distribuidor,
    fecha,
    monto
  });

  distribuidorInput.value = "";
  fechaInput.value = "";
  montoInput.value = "";

  cargarCompras();
};

/* =============================
   CARGAR COMPRAS
============================= */
async function cargarCompras() {
  lista.innerHTML = "";
  let total = 0;

  const q = query(comprasRef, orderBy("fecha", "desc"));
  const snap = await getDocs(q);

  snap.forEach(d => {
    const c = d.data();
    total += c.monto;

  const li = document.createElement("li");
li.style.display = "flex";
li.style.alignItems = "center";
li.style.justifyContent = "space-between";

const info = document.createElement("div");
info.innerHTML = `<b>${c.distribuidor}</b> — ${c.fecha}`;

const monto = document.createElement("div");
monto.textContent = `$${c.monto}`;

const btn = document.createElement("button");
btn.textContent = "❌";
btn.style.marginLeft = "15px";
btn.style.cursor = "pointer";
btn.onclick = () => borrarCompra(d.id);

const derecha = document.createElement("div");
derecha.appendChild(monto);
derecha.appendChild(btn);

li.appendChild(info);
li.appendChild(derecha);
lista.appendChild(li);

  });

  totalSpan.textContent = total;
}

/* =============================
   BORRAR COMPRA
============================= */
async function borrarCompra(id) {
  if (!confirm("¿Eliminar esta compra?")) return;

  await deleteDoc(doc(db, "compras", id));
  cargarCompras();
}

/* =============================
   INIT
============================= */
cargarCompras();
