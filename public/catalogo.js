import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { signOut } 
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
const tabla = document.getElementById("tabla");
const logoutBtn = document.getElementById("logout");

const productosRef = collection(db, "productos");

/* =============================
   CARGAR CATÁLOGO
============================= */
async function cargarCatalogo() {

  const snap = await getDocs(productosRef);

  const productos = snap.docs.map(d => d.data());

  // separar productos
  const sinStock = productos.filter(p => (p.stock ?? 0) <= 0);
  const conStock = productos.filter(p => (p.stock ?? 0) > 0);

  // ordenar con stock por categoria y nombre
  conStock.sort((a, b) => {

    const catA = a.categoria || "";
    const catB = b.categoria || "";

    if (catA !== catB) {
      return catA.localeCompare(catB, "es");
    }

    return (a.nombre || "").localeCompare(b.nombre || "", "es");

  });

  renderTabla(sinStock, conStock);

}

/* =============================
   RENDER TABLA
============================= */
function renderTabla(sinStock, conStock) {

  tabla.innerHTML = "";

  /* =============================
     SECCIÓN SIN STOCK (ROJO)
  ============================= */

  if (sinStock.length > 0) {

    const trTitulo = document.createElement("tr");

    trTitulo.innerHTML = `
      <td colspan="5" style="
        background:#ffebeb;
        color:#b00000;
        font-weight:bold;
        font-size:18px;
      ">
        🔴 PRODUCTOS SIN STOCK
      </td>
    `;

    tabla.appendChild(trTitulo);

    sinStock
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .forEach(p => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td style="color:red;">${p.codigo_barra || "-"}</td>
          <td style="color:red;">${p.nombre}</td>
          <td style="color:red;">${p.categoria || "-"}</td>
          <td style="color:red;">$${p.precio_venta}</td>
          <td style="color:red; font-weight:bold;">${p.stock}</td>
        `;

        tabla.appendChild(tr);

      });

  }

  /* =============================
     SECCIÓN CON STOCK NORMAL
  ============================= */

  let categoriaActual = "";

  conStock.forEach(p => {

    if (p.categoria !== categoriaActual) {

      categoriaActual = p.categoria;

      const trCat = document.createElement("tr");

      trCat.innerHTML = `
        <td colspan="5" style="
          font-weight:bold;
          background:#f3f4f6;
        ">
          ${categoriaActual}
        </td>
      `;

      tabla.appendChild(trCat);

    }

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.codigo_barra || "-"}</td>
      <td>${p.nombre}</td>
      <td>${p.categoria || "-"}</td>
      <td>$${p.precio_venta}</td>
      <td>${p.stock}</td>
    `;

    tabla.appendChild(tr);

  });

}

/* =============================
   LOGOUT
============================= */
logoutBtn.addEventListener("click", () => {

  signOut(auth).then(() => {

    window.location.href = "login.html";

  });

});

/* =============================
   INIT
============================= */
cargarCatalogo();