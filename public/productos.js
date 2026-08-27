import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  deleteDoc
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

const codigoBarraInput = document.getElementById("codigoBarra");
const nombreInput     = document.getElementById("nombre");
const categoriaInput  = document.getElementById("categoria");
const precioCompraInput = document.getElementById("precioCompra");
const precioVentaInput  = document.getElementById("precioVenta");
const stockInput        = document.getElementById("stock");

const multiCodigo       = document.getElementById("multiCodigo");
const contenedorCodigos = document.getElementById("contenedorCodigos");
const listaCodigos      = document.getElementById("listaCodigos");
const agregarCodigo     = document.getElementById("agregarCodigo");

const Swal           = window.Swal;
const lista          = document.getElementById("lista");
const busquedaInput  = document.getElementById("busqueda");
const filtroCategoria = document.getElementById("filtroCategoria");

let productos = [];

/* =============================
   NORMALIZADOR
============================= */
function normalizar(txt) {
  return txt.toLowerCase().trim().replace(/\s+/g, " ");
}

/* =============================
   MULTI CÓDIGOS UI
============================= */
multiCodigo.onchange = () => {
  contenedorCodigos.style.display = multiCodigo.checked ? "block" : "none";
  if (!multiCodigo.checked) listaCodigos.innerHTML = "";
};

agregarCodigo.onclick = () => {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.gap = "5px";
  div.style.marginTop = "5px";
  div.innerHTML = `
    <input class="codigoExtra" placeholder="Código adicional">
    <button type="button" onclick="this.parentElement.remove()">❌</button>
  `;
  listaCodigos.appendChild(div);
};

/* =============================
   MIGRACIÓN AUTOMÁTICA (se corre solo una vez al guardar)
============================= */
async function migrarCodigos() {
  const snap = await getDocs(productosRef);
  for (const d of snap.docs) {
    const p = d.data();
    if (p.codigo_barra && !p.codigos_barra) {
      await updateDoc(doc(db, "productos", d.id), {
        codigos_barra: [p.codigo_barra]
      });
    }
  }
}

/* =============================
   ESTADO VACÍO
============================= */
function mostrarEstadoVacio() {
  lista.innerHTML = `<li style="color:#888; padding:12px;">Ingresá un término de búsqueda o seleccioná una categoría.</li>`;
}

/* =============================
   BUSCAR EN FIRESTORE
   Solo se ejecuta cuando hay al menos 1 caracter o categoría activa
============================= */
async function buscarProductos() {
  const texto    = normalizar(busquedaInput.value);
  const categoria = filtroCategoria.value;

  const hayFiltro = texto.length > 0 || categoria !== "Todas";

  if (!hayFiltro) {
    mostrarEstadoVacio();
    return;
  }

  lista.innerHTML = `<li style="color:#888; padding:12px;">Buscando...</li>`;

  // Si hay categoría activa, filtramos en Firestore directamente
  // Si solo hay texto, traemos todo y filtramos en memoria (Firestore no soporta "contains")
  let q;
  if (categoria !== "Todas") {
    q = query(productosRef, where("categoria_normalizada", "==", categoria));
  } else {
    q = productosRef;
  }

  const snap = await getDocs(q);
  productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderLocal(texto, categoria);
}

/* =============================
   RENDER LOCAL
   Filtra en memoria lo que ya vino de Firestore
============================= */
function renderLocal(texto, categoria) {
  lista.innerHTML = "";

  const filtrados = productos.filter(p => {
    const coincideNombre  = p.nombre_normalizado?.includes(texto);
    const coincideCodigo  = p.codigos_barra?.some(c => c.toLowerCase().includes(texto));
    const coincideCategoria = categoria === "Todas" || p.categoria_normalizada === categoria;

    // Si no hay texto, no filtramos por nombre/codigo
    const coincideTexto = texto.length === 0 || coincideNombre || coincideCodigo;

    return coincideTexto && coincideCategoria;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = `<li style="color:#888; padding:12px;">Sin resultados.</li>`;
    return;
  }

  filtrados.forEach(p => {
    const li = document.createElement("li");
    const codigos = p.codigos_barra ? p.codigos_barra.join(" , ") : p.codigo_barra || "-";

    li.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div>
          <b>${codigos}</b> |
          <b>${p.nombre}</b> |
          ${p.categoria} |
          $${p.precio_compra} |
          $${p.precio_venta} |
          Stock: <b>${p.stock}</b>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button onclick="modificarStock('${p.id}', -1)">➖</button>
          <button onclick="modificarStock('${p.id}', 1)">➕</button>
          <input type="number" min="1" placeholder="+ cant" id="stock-${p.id}" style="width:70px;"/>
          <button onclick="sumarCantidad('${p.id}')">✔</button>
          <button onclick="eliminarProducto('${p.id}')">❌</button>
          <button onclick="editarProducto('${p.id}')">🔍</button>
        </div>
      </div>
    `;
    lista.appendChild(li);
  });
}

/* =============================
   GUARDAR PRODUCTO
============================= */
document.getElementById("guardar").onclick = async () => {
  let codigos_barra = [];

  const principal = codigoBarraInput.value.trim();
  if (principal) codigos_barra.push(principal);

  if (multiCodigo.checked) {
    document.querySelectorAll(".codigoExtra").forEach(input => {
      const valor = input.value.trim();
      if (valor) codigos_barra.push(valor);
    });
  }

  const nombre    = nombreInput.value.trim();
  const categoria = categoriaInput.value.trim();

  const nombre_normalizado    = normalizar(nombre);
  const categoria_normalizada = normalizar(categoria);

  const precio_compra = Number(precioCompraInput.value);
  const precio_venta  = Number(precioVentaInput.value);
  const stock         = Number(stockInput.value);

  if (!nombre || !categoria || stock <= 0 || precio_venta <= 0) return;

  // Migramos solo si es necesario (primera vez)
  await migrarCodigos();

  const q    = query(productosRef,
    where("nombre_normalizado",    "==", nombre_normalizado),
    where("categoria_normalizada", "==", categoria_normalizada)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    const ref    = doc(db, "productos", snap.docs[0].id);
    const actual = snap.docs[0].data();
    const nuevos = [...new Set([...(actual.codigos_barra || []), ...codigos_barra])];

    await updateDoc(ref, {
      stock: actual.stock + stock,
      precio_compra,
      precio_venta,
      codigos_barra: nuevos
    });
  } else {
    await addDoc(productosRef, {
      codigos_barra,
      nombre,
      nombre_normalizado,
      categoria,
      categoria_normalizada,
      precio_compra,
      precio_venta,
      stock
    });
  }

  codigoBarraInput.value  = "";
  nombreInput.value       = "";
  categoriaInput.value    = "";
  precioCompraInput.value = "";
  precioVentaInput.value  = "";
  stockInput.value        = "";

  multiCodigo.checked             = false;
  contenedorCodigos.style.display = "none";
  listaCodigos.innerHTML          = "";

  // Refrescamos los resultados actuales (no recargamos todo)
  buscarProductos();
};

/* =============================
   FUNCIONES GLOBALES
============================= */
window.modificarStock = async (id, cambio) => {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  await updateDoc(doc(db, "productos", id), {
    stock: producto.stock + cambio
  });

  buscarProductos();
};

window.sumarCantidad = async id => {
  const input    = document.getElementById(`stock-${id}`);
  const cantidad = Number(input.value);
  if (!cantidad || cantidad <= 0) return;

  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  await updateDoc(doc(db, "productos", id), {
    stock: producto.stock + cantidad
  });

  input.value = "";
  buscarProductos();
};

window.eliminarProducto = async id => {
  if (!confirm("¿Eliminar producto?")) return;
  await deleteDoc(doc(db, "productos", id));
  buscarProductos();
};

window.editarProducto = async (id) => {
  const p = productos.find(prod => prod.id === id);
  if (!p) return;

  const result = await Swal.fire({
    title: "Editar producto",
    html: `
      <input id="sw-codigo" class="swal2-input" placeholder="Códigos separados por coma"
             value="${(p.codigos_barra || []).join(",")}">
      <input id="sw-nombre" class="swal2-input" placeholder="Nombre" value="${p.nombre}">
      <input id="sw-categoria" class="swal2-input" placeholder="Categoría" value="${p.categoria}">
      <input id="sw-precio-compra" type="number" class="swal2-input" value="${p.precio_compra}">
      <input id="sw-precio-venta" type="number" class="swal2-input" value="${p.precio_venta}">
      <input id="sw-stock" type="number" class="swal2-input" value="${p.stock}">
    `,
    showCancelButton: true,
    confirmButtonText: "Guardar cambios",
    preConfirm: () => {
      const codigos = document.getElementById("sw-codigo").value
        .split(",").map(c => c.trim()).filter(c => c);

      return {
        codigos_barra: codigos,
        nombre:        document.getElementById("sw-nombre").value,
        categoria:     document.getElementById("sw-categoria").value,
        precio_compra: Number(document.getElementById("sw-precio-compra").value),
        precio_venta:  Number(document.getElementById("sw-precio-venta").value),
        stock:         Number(document.getElementById("sw-stock").value)
      };
    }
  });

  if (result.isConfirmed) {
    await updateDoc(doc(db, "productos", id), result.value);
    buscarProductos();
  }
};

/* =============================
   EVENTOS — definidos UNA SOLA VEZ
============================= */
let debounceTimer;
busquedaInput.oninput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(buscarProductos, 350);
};

filtroCategoria.onchange = buscarProductos;

/* =============================
   INIT — sin lecturas a Firestore
============================= */
mostrarEstadoVacio();