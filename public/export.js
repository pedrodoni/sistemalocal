import { auth, db } from "./firebase.js";
import { collection, getDocs }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "login.html";
});

const btn = document.getElementById("btnExportar");
const estado = document.getElementById("estado");

async function traerColeccion(nombre) {
  const snap = await getDocs(collection(db, nombre));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

btn.onclick = async () => {
  btn.disabled = true;
  estado.textContent = "Exportando...";

  const [productos, ventas, compras, gastos] = await Promise.all([
    traerColeccion("productos"),
    traerColeccion("ventas"),
    traerColeccion("compras"),
    traerColeccion("gastos")
  ]);

  const data = {
    exportado: new Date().toISOString(),
    productos,
    ventas,
    compras,
    gastos
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `catalogo-stock-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  estado.textContent = `Listo: ${productos.length} productos, ${ventas.length} ventas, ${compras.length} compras, ${gastos.length} gastos.`;
  btn.disabled = false;
};
