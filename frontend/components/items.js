const DOMICILIARY_OPTIONS = [
  { value: "relleno_sanitario", label: "Relleno sanitario" },
];

const RECYCLABLE_OPTIONS = [
  { value: "plastico", label: "Plástico" },
  { value: "carton", label: "Cartón" },
  { value: "papel", label: "Papel" },
  { value: "vidrio", label: "Vidrio" },
  { value: "metal", label: "Metales" },
  { value: "tetrapak", label: "Tetrapak" },
  { value: "organico", label: "Orgánico" },
  { value: "textil", label: "Textil" },
  { value: "raee", label: "RAEE" },
  { value: "otros", label: "Otros" },
];

function buildResidueOptions(type) {
  const options = type === "domiciliary" ? DOMICILIARY_OPTIONS : RECYCLABLE_OPTIONS;
  return options
    .map(
      (option) => `<option value="${option.value}">${option.label}</option>`
    )
    .join("");
}

export function createItemRow(type = "domiciliary", data = {}) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input name="description" placeholder="Descripción del servicio" value="${data.description || ""}" />
    <select name="residue_category">
      ${buildResidueOptions(type)}
    </select>
    <select name="unit">
      <option value="TON" ${data.unit === "TON" ? "selected" : ""}>TON</option>
      <option value="KG" ${data.unit === "KG" ? "selected" : ""}>KG</option>
    </select>
    <input type="number" step="0.01" name="quantity" placeholder="Cantidad" value="${data.quantity || 0}" />
    <input type="number" step="0.01" name="amount" placeholder="Monto (CLP/UF)" value="${data.amount || 0}" />
    <button type="button" class="remove">✕</button>
  `;
  const select = row.querySelector('select[name="residue_category"]');
  if (data.residue_category) {
    select.value = data.residue_category;
  }
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  return row;
}

export function refreshResidueSelects(container, type) {
  container.querySelectorAll('select[name="residue_category"]').forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = buildResidueOptions(type);
    select.value = currentValue;
    if (!select.value) {
      select.selectedIndex = 0;
    }
  });
}

export function collectItems(container) {
  const rows = Array.from(container.querySelectorAll(".item-row"));
  return rows.map((row) => ({
    description: row.querySelector('input[name="description"]').value,
    residue_category: row.querySelector('select[name="residue_category"]').value,
    unit: row.querySelector('select[name="unit"]').value,
    quantity: parseFloat(row.querySelector('input[name="quantity"]').value || "0"),
    amount: parseFloat(row.querySelector('input[name="amount"]').value || "0"),
  }));
}
