import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =============================
   AUTH
============================= */
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "login.html";
});

/* =============================
   REFS
============================= */
const productosRef = collection(db, "productos");

const lista = document.getElementById("lista");
const busquedaInput = document.getElementById("busqueda");
const filtroCategoria = document.getElementById("filtroCategoria");
const totalCompraSpan = document.getElementById("totalCompra");
const totalVentaSpan = document.getElementById("totalVenta");


let productos = [];

/* =============================
   NORMALIZADOR (IGUAL A PRODUCTOS)
============================= */
function normalizar(txt) {
  return txt
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/* =============================
   CARGAR PRODUCTOS
============================= */
async function cargarProductos() {
  const snap = await getDocs(productosRef);
  productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cargarCategorias();
  render();
}

/* =============================
   CARGAR CATEGORÍAS NORMALIZADAS
============================= */
function cargarCategorias() {
  const map = {};

  productos.forEach(p => {
    if (p.categoria_normalizada && !map[p.categoria_normalizada]) {
      map[p.categoria_normalizada] = p.categoria;
    }
  });

  filtroCategoria.innerHTML = `<option value="Todas">Todas</option>`;

  Object.entries(map).forEach(([key, label]) => {
    filtroCategoria.innerHTML += `
      <option value="${key}">${label}</option>
    `;
  });
}

/* =============================
   RENDER DE MÁRGENES
============================= */
function render() {
  lista.innerHTML = "";

  const texto = normalizar(busquedaInput.value);
  const categoria = filtroCategoria.value;

  let totalCompra = 0;
  let totalVenta = 0;

  productos
    .map(p => {
      const margen =
        p.precio_compra > 0
          ? ((p.precio_venta - p.precio_compra) / p.precio_compra) * 100
          : 0;

      return { ...p, margen };
    })
    .filter(p =>
      p.nombre_normalizado.includes(texto) &&
      (categoria === "Todas" || p.categoria_normalizada === categoria)
    )
    .forEach(p => {
      const stock = Number(p.stock) || 0;

      totalCompra += p.precio_compra * stock;
      totalVenta += p.precio_venta * stock;

      const li = document.createElement("li");
      li.className = "margen-item";

      li.innerHTML = `
        <div class="margen-info">
          <strong>${p.nombre}</strong>
          <span class="categoria">${p.categoria}</span>
        </div>

        <div class="margen-precios">
          <span>Compra: $${p.precio_compra}</span>
          <span>Venta: $${p.precio_venta}</span>
        </div>

        <div class="margen-valor">
          ${p.margen.toFixed(1)}%
        </div>
      `;

      lista.appendChild(li);
    });

  // 🔹 MOSTRAR TOTALES
  totalCompraSpan.textContent = `$${totalCompra.toLocaleString("es-AR")}`;
  totalVentaSpan.textContent = `$${totalVenta.toLocaleString("es-AR")}`;
}



/* =============================
   EVENTOS
============================= */
busquedaInput.addEventListener("input", render);
filtroCategoria.addEventListener("change", render);

/* =============================
   INIT
============================= */
cargarProductos();
