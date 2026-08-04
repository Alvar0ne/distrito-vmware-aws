"use client";

import { useState } from "react";
import type { Promotion } from "@/lib/promotionStore";
import { formatCLP } from "@/lib/pricing";

type AdminPromotionsPanelProps = {
  promotions: Promotion[];
};

function getPromotionValue(promotion: Promotion) {
  return promotion.type === "percent" ? `${promotion.value}%` : formatCLP(promotion.value);
}

export function AdminPromotionsPanel({ promotions }: AdminPromotionsPanelProps) {
  const [items, setItems] = useState(promotions);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Promotion["type"]>("percent");
  const [value, setValue] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          description,
          type,
          value: Number(value),
          active
        })
      });
      const data = (await response.json()) as { promotion?: Promotion; error?: string };
      if (!response.ok || !data.promotion) {
        throw new Error(data.error ?? "No se pudo guardar la promocion.");
      }

      const savedPromotion = data.promotion;
      setItems((current) => {
        const exists = current.some((promotion) => promotion.id === savedPromotion.id);
        return exists
          ? current.map((promotion) =>
              promotion.id === savedPromotion.id ? savedPromotion : promotion
            )
          : [savedPromotion, ...current];
      });
      setCode("");
      setDescription("");
      setValue("");
      setType("percent");
      setActive(true);
      setMessage({ type: "success", text: "Promocion guardada correctamente." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la promocion."
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const confirmed = window.confirm("¿Eliminar esta promocion?");
    if (!confirmed) return;

    setMessage(null);
    const response = await fetch(`/api/admin/promotions?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (response.ok) {
      setItems((current) => current.filter((promotion) => promotion.id !== id));
      setMessage({ type: "success", text: "Promocion eliminada." });
    } else {
      setMessage({ type: "error", text: "No se pudo eliminar la promocion." });
    }
  }

  return (
    <section className="adminPanel">
      <div className="panelHead">
        <div>
          <h2>Promociones</h2>
          <span>Gestion de codigos de descuento para campañas y clientes.</span>
        </div>
      </div>

      <div className="promotionEditor">
        <label className="adminField">
          Codigo
          <input
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="MIAMI10"
            value={code}
          />
        </label>
        <label className="adminField">
          Descripcion
          <input
            onChange={(event) => setDescription(event.target.value)}
            placeholder="10% para clientes frecuentes"
            value={description}
          />
        </label>
        <label className="adminField">
          Tipo
          <select onChange={(event) => setType(event.target.value as Promotion["type"])} value={type}>
            <option value="percent">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </label>
        <label className="adminField">
          Descuento
          <input
            inputMode="numeric"
            onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
            placeholder={type === "percent" ? "10" : "5000"}
            value={value}
          />
        </label>
        <label className="adminCheckFilter promotionActive">
          <input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />
          <span>Activo</span>
        </label>
        <button className="adminPanelAction" disabled={saving} onClick={save} type="button">
          {saving ? "Guardando..." : "Guardar promocion"}
        </button>
      </div>

      {message ? (
        <div className={`adminProductMessage ${message.type}`} role="status">{message.text}</div>
      ) : null}

      <div className="promotionsList">
        {items.length ? (
          items.map((promotion) => (
            <article className="promotionRow" key={promotion.id}>
              <div>
                <strong>{promotion.code}</strong>
                <span>{promotion.description || "Sin descripcion"}</span>
              </div>
              <strong>{getPromotionValue(promotion)}</strong>
              <span className={`promotionStatus ${promotion.active ? "active" : "inactive"}`}>
                {promotion.active ? "Activa" : "Inactiva"}
              </span>
              <button onClick={() => remove(promotion.id)} type="button">Eliminar</button>
            </article>
          ))
        ) : (
          <div className="emptyAdminState">
            <strong>Aun no hay promociones.</strong>
            <span>Crea el primer codigo para usarlo despues en checkout.</span>
          </div>
        )}
      </div>
    </section>
  );
}
