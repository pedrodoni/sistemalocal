import { auth, db } from "./firebase.js";
import { collection, getDocs }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

const listaProductos           = document.getElementById("listaProductos");
const busquedaInput             = document.getElementById("busqueda");
const filtroCategoria           = document.getElementById("filtroCategoria");
const cantidadSeleccionadosSpan = document.getElementById("cantidadSeleccionados");
const cantidadHojasSpan         = document.getElementById("cantidadHojas");
const btnImprimir               = document.getElementById("btnImprimir");
const hojasContainer            = document.getElementById("hojas");

const POR_HOJA = 24; // 4 columnas x 6 filas, tal como entra en una A4

let productos     = [];
let seleccionados = new Set();

/* =============================
   NORMALIZADOR
============================= */
function normalizar(txt = "") {
  return txt.toLowerCase().trim().replace(/\s+/g, " ");
}

/* =============================
   CARGAR PRODUCTOS
============================= */
async function cargarProductos() {
  const snap = await getDocs(productosRef);
  productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cargarCategorias();
  renderLista();
}

/* =============================
   CATEGORÍAS PARA EL FILTRO
============================= */
function cargarCategorias() {
  const map = {};

  productos.forEach(p => {
    const cat = p.categoria || "Sin categoría";
    const key = normalizar(cat);
    if (!map[key]) map[key] = cat;
  });

  filtroCategoria.innerHTML = `<option value="Todas">Todas las categorías</option>`;

  Object.entries(map)
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([key, label]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = label;
      filtroCategoria.appendChild(opt);
    });
}

/* =============================
   LISTA DE SELECCIÓN
============================= */
function renderLista() {
  const texto     = normalizar(busquedaInput.value);
  const categoria = filtroCategoria.value;

  listaProductos.innerHTML = "";

  const filtrados = productos.filter(p => {
    const coincideTexto     = texto === "" || normalizar(p.nombre).includes(texto);
    const coincideCategoria = categoria === "Todas" ||
      normalizar(p.categoria || "Sin categoría") === categoria;
    return coincideTexto && coincideCategoria;
  });

  if (filtrados.length === 0) {
    listaProductos.innerHTML = `<li style="color:#888;">Sin resultados.</li>`;
    return;
  }

  filtrados.forEach(p => {
    const li = document.createElement("li");
    const marcado = seleccionados.has(p.id) ? "checked" : "";

    li.innerHTML = `
      <label>
        <input type="checkbox" data-id="${p.id}" ${marcado}>
        <span style="flex:1;">${p.nombre}</span>
        <span style="color:#666;">$${p.precio_venta}</span>
      </label>
    `;

    li.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) seleccionados.add(p.id);
      else seleccionados.delete(p.id);

      actualizarContador();
      renderHojas();
    });

    listaProductos.appendChild(li);
  });
}

/* =============================
   CONTADOR
============================= */
function actualizarContador() {
  const cantidad = seleccionados.size;
  const hojas    = Math.ceil(cantidad / POR_HOJA) || 0;

  cantidadSeleccionadosSpan.textContent = cantidad;
  cantidadHojasSpan.textContent         = hojas;
}

/* =============================
   ARMAR LAS HOJAS IMPRIMIBLES
============================= */
function renderHojas() {
  hojasContainer.innerHTML = "";

  const elegidos = productos.filter(p => seleccionados.has(p.id));
  if (elegidos.length === 0) return;

  for (let i = 0; i < elegidos.length; i += POR_HOJA) {
    const grupo = elegidos.slice(i, i + POR_HOJA);

    const hoja = document.createElement("div");
    hoja.className = "hoja";

    const grilla = document.createElement("div");
    grilla.className = "grilla";

    grupo.forEach(p => {
      const etiqueta = document.createElement("div");
      etiqueta.className = "etiqueta";
      etiqueta.innerHTML = `
        <div class="logo-cell"><img src="logo.png" alt="Logo"></div>
        <div class="nombre-cell">${p.nombre}</div>
        <div class="precio-cell">$${p.precio_venta}</div>
      `;
      grilla.appendChild(etiqueta);
    });

    // Celdas vacías para que la última hoja no se desarme si tiene menos de 24
    for (let j = grupo.length; j < POR_HOJA; j++) {
      grilla.appendChild(document.createElement("div"));
    }

    hoja.appendChild(grilla);
    hojasContainer.appendChild(hoja);
  }
}

/* =============================
   IMPRIMIR
============================= */
btnImprimir.addEventListener("click", () => {
  if (seleccionados.size === 0) {
    alert("Seleccioná al menos un producto para imprimir.");
    return;
  }
  window.print();
});

/* =============================
   EVENTOS
============================= */
busquedaInput.addEventListener("input", renderLista);
filtroCategoria.addEventListener("change", renderLista);

/* =============================
   INIT
============================= */
cargarProductos();