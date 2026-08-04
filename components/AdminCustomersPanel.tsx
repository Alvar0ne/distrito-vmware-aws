"use client";

import { useMemo, useState } from "react";
import type { StoredCustomer } from "@/lib/customerStore";

type AdminCustomersPanelProps = {
  customers: StoredCustomer[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function optionalValue(value: string, fallback = "Sin registrar") {
  return value.trim() || fallback;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function AdminCustomersPanel({ customers }: AdminCustomersPanelProps) {
  const [query, setQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    if (!normalizedQuery) return customers;

    return customers.filter((customer) =>
      normalizeText(
        [
          customer.name,
          customer.rut,
          customer.email,
          customer.phone,
          customer.region,
          customer.commune,
          customer.shippingAddress
        ].join(" ")
      ).includes(normalizedQuery)
    );
  }, [customers, query]);

  const returningCustomers = customers.filter((customer) => customer.orderCount > 1).length;
  const importedCustomers = customers.filter((customer) => customer.orderCount === 0).length;

  function exportCustomers() {
    const headers = [
      "Nombre",
      "RUT",
      "Correo",
      "Telefono",
      "Region",
      "Comuna",
      "Direccion",
      "Pedidos",
      "Primera compra",
      "Ultima compra"
    ];
    const rows = filteredCustomers.map((customer) => [
      customer.name,
      customer.rut,
      customer.email,
      customer.phone,
      customer.region,
      customer.commune,
      customer.shippingAddress,
      customer.orderCount,
      customer.firstOrderAt,
      customer.lastOrderAt
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clientes-distrito-miami-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="adminPanel">
      <div className="panelHead customersPanelHead">
        <div>
          <h2>Clientes</h2>
          <span>{filteredCustomers.length} cliente(s) visibles</span>
        </div>
        <button disabled={!filteredCustomers.length} onClick={exportCustomers} type="button">
          Exportar CSV
        </button>
      </div>

      <div className="customerStatsGrid">
        <article>
          <span>Clientes registrados</span>
          <strong>{customers.length}</strong>
        </article>
        <article>
          <span>Clientes con mas de un pedido</span>
          <strong>{returningCustomers}</strong>
        </article>
        <article>
          <span>Correos importados</span>
          <strong>{importedCustomers}</strong>
        </article>
      </div>

      <div className="adminFilterBar customerFilterBar">
        <label className="adminFilterGroup">
          Buscar cliente
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, RUT, correo, telefono o comuna"
            value={query}
          />
        </label>
      </div>

      <div className="customersList">
        {filteredCustomers.length ? (
          filteredCustomers.map((customer) => (
            <article className="customerRow" key={customer.id}>
              <div className="customerIdentity">
                <strong>{optionalValue(customer.name, "Cliente importado")}</strong>
                <span>RUT: {optionalValue(customer.rut)}</span>
              </div>
              <div>
                <a href={`mailto:${customer.email}`}>{customer.email}</a>
                {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : <span>Telefono sin registrar</span>}
              </div>
              <div>
                <strong>{optionalValue(customer.commune, "Comuna sin registrar")}</strong>
                <span>{optionalValue(customer.region, "Region sin registrar")}</span>
                <small>{optionalValue(customer.shippingAddress, "Direccion sin registrar")}</small>
              </div>
              <div className="customerOrderInfo">
                <strong>{customer.orderCount ? `${customer.orderCount} pedido(s)` : "Importado"}</strong>
                <span>Ultimo: {customer.orderCount ? formatDate(customer.lastOrderAt) : "Sin compra"}</span>
                <small>Primero: {customer.orderCount ? formatDate(customer.firstOrderAt) : "CSV"}</small>
              </div>
            </article>
          ))
        ) : (
          <div className="emptyAdminState">
            <strong>No hay clientes con esa busqueda.</strong>
            <span>Prueba buscando por nombre, correo, RUT, telefono o ubicacion.</span>
          </div>
        )}
      </div>
    </section>
  );
}
