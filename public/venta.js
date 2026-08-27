import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "login.html";
});

const Swal = window.Swal;

/* =============================
   REFS
============================= */
const listaProductos = document.getElementById("productos");
const listaCarrito = document.getElementById("carrito");
const totalSpan = document.getElementById("total");
const totalFinalSpan = document.getElementById("totalFinal");
const descuentoInput = document.getElementById("descuento");

const calcMonto = document.getElementById("calcMonto");
const calcPago = document.getElementById("calcPago");
const calcVuelto = document.getElementById("calcVuelto");


const buscarInput = document.getElementById("buscar");
const buscarCodigoInput = document.getElementById("buscarCodigo");
const categoriaSelect = document.getElementById("categoria");
const btnConfirmar = document.getElementById("confirmar");

const sueltoNombre = document.getElementById("sueltoNombre");
const sueltoPrecio = document.getElementById("sueltoPrecio");
const sueltoCantidad = document.getElementById("sueltoCantidad");
const btnAgregarSuelto = document.getElementById("agregarSuelto");

let productos = [];
let carrito = [];
function obtenerMedioPago() {
  const seleccionado =
    document.querySelector('input[name="medioPago"]:checked');

  return seleccionado ? seleccionado.value : "efectivo";
}

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
  const snap = await getDocs(collection(db, "productos"));
  productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cargarCategorias();
  renderProductos();
}

/* =============================
   CATEGORÍAS
============================= */
function cargarCategorias() {
  const map = {};

  productos.forEach(p => {
    if (p.categoria_normalizada && !map[p.categoria_normalizada]) {
      map[p.categoria_normalizada] = p.categoria;
    }
  });

  categoriaSelect.innerHTML = `<option value="">Todas</option>`;

  Object.entries(map)
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([key, label]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = label;
      categoriaSelect.appendChild(opt);
    });
}

/* =============================
   RENDER PRODUCTOS (MEJORADO)
============================= */
function renderProductos() {
  listaProductos.innerHTML = "";

  const texto = normalizar(buscarInput.value);
  const codigoBuscado = normalizar(buscarCodigoInput.value);
  const categoria = categoriaSelect.value;

  productos
    .filter(p => {
      const nombre = normalizar(p.nombre);
      const marca = normalizar(p.marca || "");

      // 🔥 NUEVO: búsqueda en ARRAY de códigos
      const codigos = p.codigos_barra || [];

      const coincideTexto =
        texto === "" ||
        nombre.includes(texto) ||
        marca.includes(texto);

      const coincideCodigo =
        codigoBuscado === "" ||
        codigos.some(c =>
          normalizar(c).includes(codigoBuscado)
        );

      const coincideCategoria =
        categoria === "" ||
        p.categoria_normalizada === categoria;

      return coincideTexto && coincideCodigo && coincideCategoria;
    })
    .forEach(p => {

      const stockColor =
        p.stock < 0 ? "red" :
        p.stock === 0 ? "orange" : "green";

      const codigosMostrados = p.codigos_barra
        ? p.codigos_barra.join(" , ")
        : "-";

      const li = document.createElement("li");
      li.innerHTML = `
        <b>${p.nombre}</b><br>
        <small>Categoría: ${p.categoria || "-"}</small><br>
        <small>Códigos: ${codigosMostrados}</small><br>
        $${p.precio_venta} |
        Stock: <b style="color:${stockColor}">${p.stock}</b><br>

        <button onclick="restarUno('${p.id}')">➖</button>
        <button onclick="agregarUno('${p.id}')">➕</button>
        Cant:
        <input type="number" min="1" value="1" id="q-${p.id}" style="width:50px">
        <button onclick="agregarCantidad('${p.id}')">Agregar</button>
      `;

      listaProductos.appendChild(li);
    });
}


/* =============================
   AGREGAR / RESTAR
============================= */
window.agregarUno = id => {
  const producto = productos.find(p => p.id === id);
  agregarAlCarrito(producto, 1);
};

window.restarUno = id => {
  const item = carrito.find(i => i.id === id);
  if (!item) return;

  item.cantidad--;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.id !== id);
  }
  renderCarrito();
};

window.agregarCantidad = id => {
  const producto = productos.find(p => p.id === id);
  const cant = Number(document.getElementById(`q-${id}`).value);
  if (!cant || cant <= 0) return;
  agregarAlCarrito(producto, cant);
};

function agregarAlCarrito(producto, cantidad) {
  const item = carrito.find(i => i.id === producto.id);

  if (item) item.cantidad += cantidad;
  else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio_venta: producto.precio_venta,
      precio_compra: producto.precio_compra ?? 0,   // 📸 foto del costo en este momento
      categoria: producto.categoria || producto.categoria_normalizada || "Sin categoría",
      cantidad
    });
  }

  renderCarrito();
}

/* =============================
   RENDER CARRITO
============================= */
function renderCarrito() {
  listaCarrito.innerHTML = "";
  let subtotal = 0;

  carrito.forEach((item, index) => {
    const totalItem = item.precio_venta * item.cantidad;
    subtotal += totalItem;

    const li = document.createElement("li");
    li.innerHTML = `
      ${item.nombre} x${item.cantidad} = $${totalItem}
      <button onclick="eliminarDelCarrito(${index})">❌</button>
    `;
    listaCarrito.appendChild(li);
  });

  if (totalSpan) {
  totalSpan.textContent = subtotal;
}


  const descuento = Number(descuentoInput?.value) || 0;
  const totalFinal = Math.max(subtotal - descuento, 0);

  if (totalFinalSpan) {
    totalFinalSpan.textContent = totalFinal;
  }
}


window.eliminarDelCarrito = index => {
  carrito.splice(index, 1);
  renderCarrito();
};
/* =============================
   IMPRIMIR TICKET
============================= */

function generarHTMLTicket(carrito, subtotal, descuento, total, medioPago, cliente) {

  const fecha = new Date().toLocaleString("es-AR");

  let productosHTML = "";

  carrito.forEach(p => {

    const subtotalItem = p.precio_venta * p.cantidad;

    productosHTML += `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.cantidad}</td>
        <td>$${p.precio_venta}</td>
        <td>$${subtotalItem}</td>
      </tr>
    `;

  });

  return `
  <html>
  <head>
    <title>Ticket</title>
    <style>

      body{
        font-family: Arial;
        padding:20px;
      }

      table{
        width:100%;
        border-collapse: collapse;
      }

      td, th{
        border-bottom:1px solid #ccc;
        padding:6px;
        text-align:left;
      }

      .total{
        font-size:20px;
        font-weight:bold;
        margin-top:10px;
      }

    </style>
  </head>

  <body>

    <h2>Resumen de venta</h2>

    Fecha: ${fecha}<br>
    Cliente: ${cliente}<br>
    Medio de pago: ${medioPago}

    <table>

      <thead>
        <tr>
          <th>Producto</th>
          <th>Cant</th>
          <th>Precio</th>
          <th>Subtotal</th>
        </tr>
      </thead>

      <tbody>
        ${productosHTML}
      </tbody>

    </table>

    <div class="total">
      Subtotal: $${subtotal}<br>
      Descuento: $${descuento}<br>
      TOTAL: $${total}
    </div>

  </body>
  </html>
  `;
}


function imprimirTicket(carrito, subtotal, descuento, total, medioPago, cliente){

  const html = generarHTMLTicket(
    carrito,
    subtotal,
    descuento,
    total,
    medioPago,
    cliente
  );

  const ventana = window.open("", "_blank");

  ventana.document.write(html);

  ventana.document.close();

  ventana.focus();

  ventana.print();

}

/* =============================
   CONFIRMAR VENTA
============================= */
btnConfirmar.onclick = async () => {

  if (carrito.length === 0) {
    Swal.fire("Carrito vacío", "", "info");
    return;
  }
    const medioPago = obtenerMedioPago();

function obtenerMedioPago() {
  const seleccionado =
    document.querySelector('input[name="medioPago"]:checked');

  return seleccionado ? seleccionado.value : "efectivo";
}
  let subtotal = 0;
  let html = "<ul>";

  carrito.forEach(i => {
  subtotal += i.precio_venta * i.cantidad;

    html += `<li>${i.nombre} x${i.cantidad}</li>`;
  });

  const descuento = Number(descuentoInput?.value) || 0;
const total = Math.max(subtotal - descuento, 0);

html += `
</ul>
<hr>
Subtotal: $${subtotal}<br>
Descuento: $${descuento}<br>
<b>Total: $${total}</b>
`;


  const cliente =
    document.getElementById("cliente").value || "Consumidor final";

 const r = await Swal.fire({
  title: "Confirmar venta",
  html,
  showCancelButton: true,
  showDenyButton: true,

  confirmButtonText: "Confirmar",
  denyButtonText: "🖨️ Imprimir",
  cancelButtonText: "Cancelar"
});

  if (r.isDenied) {

  imprimirTicket(
    carrito,
    subtotal,
    descuento,
    total,
    medioPago,
    cliente
  );

  return;
}

if (!r.isConfirmed) return;

  for (const item of carrito) {
    if (item.suelto) continue;
    await updateDoc(doc(db, "productos", item.id), {
      stock: increment(-item.cantidad)
    });
  }

await addDoc(collection(db, "ventas"), {
  fecha: serverTimestamp(),
  subtotal,
  descuento,
  total,
  items:carrito,

  cliente,
  items: carrito,

  medioPago, // 🔥 NUEVO CAMPO

  anulada: false
});

  carrito = [];
  renderCarrito();
  document.getElementById("cliente").value = "";
  cargarProductos();

  Swal.fire("Venta confirmada", "", "success");
};

/* =============================
   SUELTO
============================= */
btnAgregarSuelto.onclick = () => {
  const nombre = sueltoNombre.value.trim();
  const precio = Number(sueltoPrecio.value);
  const cantidad = Number(sueltoCantidad.value);

  if (!nombre || precio <= 0 || cantidad <= 0) {
    Swal.fire("Datos inválidos", "", "warning");
    return;
  }

  carrito.push({
    id: "suelto-" + Date.now(),
    nombre,
    precio_venta: precio,
    cantidad,
    suelto: true
  });

  sueltoNombre.value = "";
  sueltoPrecio.value = "";
  sueltoCantidad.value = 1;

  renderCarrito();
};
function calcularVuelto() {
  if (!calcMonto || !calcPago || !calcVuelto) return;

  const monto = Number(calcMonto.value) || 0;
  const pago = Number(calcPago.value) || 0;
  const vuelto = pago - monto;

  calcVuelto.textContent = vuelto >= 0 ? vuelto : 0;
}

if (calcMonto && calcPago) {
  calcMonto.oninput = calcularVuelto;
  calcPago.oninput = calcularVuelto;
}
if (descuentoInput) {
  descuentoInput.oninput = renderCarrito;
}


/* =============================
   INIT
============================= */
buscarInput.oninput = renderProductos;
buscarCodigoInput.oninput = renderProductos;
categoriaSelect.onchange = renderProductos;

cargarProductos();