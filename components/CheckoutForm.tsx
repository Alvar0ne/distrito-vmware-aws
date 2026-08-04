"use client";

import { useEffect, useMemo, useState } from "react";
import { CART_STORAGE_KEY, normalizeCartLines } from "@/lib/cart";
import { CHILE_REGIONS, getCommunesForRegion } from "@/lib/chileLocations";
import { formatCartLineDetail } from "@/lib/productDisplay";
import {
  calculateCheckoutTotals,
  formatCLP,
  SHIPPING_METHODS,
  SANTIAGO_REGION,
  SANTIAGO_SHIPPING_FEE,
  type AppliedPromotion,
  type CartLine,
  type ShippingMethod
} from "@/lib/pricing";
import type { Product } from "@/lib/products";
import { cleanRut, isValidRutFormat } from "@/lib/rut";

type CheckoutFormProps = {
  products: Product[];
};

type CheckoutResult = {
  order: {
    id: string;
    totals: {
      total: number;
    };
  };
  payment: {
    token: string;
    url: string;
  };
};

export function CheckoutForm({ products }: CheckoutFormProps) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(SHIPPING_METHODS.HOME);
  const [customerRut, setCustomerRut] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<AppliedPromotion | null>(null);
  const [promotionStatus, setPromotionStatus] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const [applyingPromotion, setApplyingPromotion] = useState(false);

  useEffect(() => {
    const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCart) return;

    try {
      const parsed = JSON.parse(storedCart) as CartLine[];
      setLines(normalizeCartLines(parsed));
    } catch {
      setLines([]);
    }
  }, []);

  const totals = useMemo(
    () => calculateCheckoutTotals(lines, products, selectedRegion, shippingMethod, appliedPromotion),
    [lines, products, selectedRegion, shippingMethod, appliedPromotion]
  );

  const shouldValidateRut = customerRut.length > 0;
  const rutIsValid = shouldValidateRut && isValidRutFormat(customerRut);
  const shouldValidateEmail = customerEmail.length > 0;
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail);
  const phoneDigits = customerPhone.replace(/\D/g, "");
  const shouldValidatePhone = customerPhone.length > 0;
  const phoneIsValid = phoneDigits.length >= 8 && phoneDigits.length <= 12;
  const formHasInvalidFields =
    !rutIsValid ||
    (shouldValidateEmail && !emailIsValid) ||
    (shouldValidatePhone && !phoneIsValid);

  function cleanPhone(value: string) {
    return value.replace(/[^\d+\s]/g, "").replace(/(?!^)\+/g, "");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    if (formHasInvalidFields) {
      setStatus("error");
      setMessage("Revisa los campos marcados en rojo.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      customerName: String(formData.get("customerName") ?? ""),
      customerRut,
      customerEmail,
      customerPhone,
      shippingRegion: String(formData.get("shippingRegion") ?? ""),
      shippingCommune: String(formData.get("shippingCommune") ?? ""),
      shippingMethod,
      shippingAddress: String(formData.get("shippingAddress") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      promotionCode: appliedPromotion?.code ?? "",
      lines
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as CheckoutResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Revisa los campos marcados en rojo.");
      }

      window.location.assign(data.payment.url);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Revisa los campos marcados en rojo.");
    }
  }

  async function applyPromotion() {
    const code = promotionCode.trim().toUpperCase();
    setPromotionStatus(null);

    if (!code) {
      setAppliedPromotion(null);
      setPromotionStatus({ type: "error", text: "Ingresa un codigo de descuento." });
      return;
    }

    if (!lines.length) {
      setPromotionStatus({ type: "error", text: "Agrega productos antes de aplicar un codigo." });
      return;
    }

    setApplyingPromotion(true);
    try {
      const response = await fetch("/api/promotions/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code,
          shippingRegion: selectedRegion,
          shippingMethod,
          lines
        })
      });
      const data = (await response.json()) as {
        promotion?: AppliedPromotion & { description?: string };
        error?: string;
      };

      if (!response.ok || !data.promotion) {
        throw new Error(data.error ?? "No se pudo aplicar el codigo.");
      }

      setAppliedPromotion({
        code: data.promotion.code,
        type: data.promotion.type,
        value: data.promotion.value
      });
      setPromotionCode(data.promotion.code);
      setPromotionStatus({
        type: "success",
        text: data.promotion.description || `Codigo ${data.promotion.code} aplicado.`
      });
    } catch (error) {
      setAppliedPromotion(null);
      setPromotionStatus({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo aplicar el codigo."
      });
    } finally {
      setApplyingPromotion(false);
    }
  }

  const communes = getCommunesForRegion(selectedRegion);
  const isSantiagoRegion = selectedRegion === SANTIAGO_REGION;
  const isStarkenShipping = shippingMethod === SHIPPING_METHODS.STARKEN;
  const shippingLabels = {
    home: isSantiagoRegion
      ? `Envio a domicilio (${formatCLP(SANTIAGO_SHIPPING_FEE)})`
      : "Envio a domicilio (por pagar)",
    starken: "Sucursal de Starken (por pagar)"
  };

  return (
    <div className="checkoutLayout">
      <section className="checkoutCard">
        <h1>Contacto y despacho</h1>
        <form className="checkoutForm" onSubmit={handleSubmit}>
          <div className="formGrid">
            <label>
              Nombre
              <input name="customerName" placeholder="Nombre y apellido" required minLength={2} />
            </label>
            <label>
              RUT
              <input
                aria-describedby="rut-help"
                aria-invalid={shouldValidateRut && !rutIsValid}
                className={shouldValidateRut && !rutIsValid ? "inputError" : ""}
                name="customerRut"
                onChange={(event) => setCustomerRut(cleanRut(event.target.value))}
                placeholder="12345678-9"
                required
                value={customerRut}
              />
              <span
                className={
                  shouldValidateRut ? (rutIsValid ? "fieldHint success" : "fieldHint error") : "fieldHint"
                }
                id="rut-help"
              >
                {shouldValidateRut
                  ? rutIsValid
                    ? "RUT valido"
                    : "Sin puntos, con guion y digito verificador. Ej: 12345678-9"
                  : "Sin puntos, con guion y digito verificador. Ej: 12345678-9"}
              </span>
            </label>
          </div>
          <div className="formGrid">
            <label>
              Correo
              <input
                aria-invalid={shouldValidateEmail && !emailIsValid}
                className={shouldValidateEmail && !emailIsValid ? "inputError" : ""}
                name="customerEmail"
                onChange={(event) => setCustomerEmail(event.target.value.trim())}
                placeholder="correo@ejemplo.cl"
                required
                type="email"
                value={customerEmail}
              />
              {shouldValidateEmail && !emailIsValid ? (
                <span className="fieldHint error">Ingresa un correo valido.</span>
              ) : null}
            </label>
            <label>
              Telefono
              <input
                aria-invalid={shouldValidatePhone && !phoneIsValid}
                className={shouldValidatePhone && !phoneIsValid ? "inputError" : ""}
                inputMode="tel"
                name="customerPhone"
                onChange={(event) => setCustomerPhone(cleanPhone(event.target.value))}
                placeholder="+56 9 ..."
                required
                value={customerPhone}
              />
              {shouldValidatePhone && !phoneIsValid ? (
                <span className="fieldHint error">Ingresa un telefono valido, solo numeros.</span>
              ) : null}
            </label>
          </div>
          <div className="formGrid">
            <label>
              Region
              <select
                name="shippingRegion"
                onChange={(event) => {
                  setSelectedRegion(event.target.value);
                  setShippingMethod(SHIPPING_METHODS.HOME);
                }}
                required
                value={selectedRegion}
              >
                <option value="">Selecciona region</option>
                {CHILE_REGIONS.map((region) => (
                  <option key={region.name} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comuna
              <select disabled={!selectedRegion} name="shippingCommune" required>
                <option value="">Selecciona comuna</option>
                {communes.map((commune) => (
                  <option key={commune} value={commune}>
                    {commune}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="shippingMethods">
            <legend>Metodo de envio</legend>
            <label>
              <input
                checked={shippingMethod === SHIPPING_METHODS.HOME}
                name="shippingMethod"
                onChange={() => setShippingMethod(SHIPPING_METHODS.HOME)}
                type="radio"
                value={SHIPPING_METHODS.HOME}
              />
              <span>{shippingLabels.home}</span>
            </label>
            <label>
              <input
                checked={shippingMethod === SHIPPING_METHODS.STARKEN}
                name="shippingMethod"
                onChange={() => setShippingMethod(SHIPPING_METHODS.STARKEN)}
                type="radio"
                value={SHIPPING_METHODS.STARKEN}
              />
              <span>{shippingLabels.starken}</span>
            </label>
          </fieldset>
          <label>
            {isStarkenShipping ? "Sucursal destino" : "Direccion de envio"}
            <input
              name="shippingAddress"
              placeholder={
                isStarkenShipping
                  ? "Ej: Starken Providencia, Starken Temuco Centro"
                  : "Calle, numero, depto/casa"
              }
              required
              minLength={isStarkenShipping ? 3 : 8}
            />
          </label>
          <label>
            Notas
            <textarea name="notes" placeholder="Indicaciones, horario, referencia" rows={4} />
          </label>

          <fieldset className="checkoutPaymentMethod">
            <legend>Metodo de pago</legend>
            <label>
              <input checked readOnly name="paymentMethod" type="radio" value="flow" />
              <span className="webpayMark" aria-hidden="true">
                webpay<span>.</span>
              </span>
              <span className="paymentMethodCopy">
                <strong>Tarjetas de credito y debito</strong>
                <small>Visa, Mastercard, Magna, American Express y Redcompra.</small>
              </span>
            </label>
            <p>
              Si pagas con tarjeta de credito, en los pasos siguientes podras seleccionar las
              cuotas disponibles. Pago seguro procesado por Flow.
            </p>
          </fieldset>

          <button
            className="checkoutButton formSubmit"
            disabled={!lines.length || status === "submitting" || formHasInvalidFields}
            type="submit"
          >
            {status === "submitting" ? "Conectando con Flow..." : "Realizar pedido y pagar"}
          </button>
        </form>

        {message ? (
          <div className={status === "error" ? "formMessage error" : "formMessage"}>
            <strong>{message}</strong>
          </div>
        ) : null}
      </section>

      <aside className="checkoutCard orderSummary">
        <h2>Revision del pedido</h2>
        {lines.length ? (
          <div className="summaryLines">
            {lines.map((line) => {
              const product = products.find((item) => item.id === line.productId);
              if (!product) return null;
              return (
                <div className="summaryLine" key={`${line.productId}-${line.size}`}>
                  <img
                    alt={product.name}
                    className="summaryProductImage"
                    src={product.images[0] ?? "/placeholder-product.jpg"}
                  />
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatCartLineDetail(product, line.size, line.quantity)}</span>
                  </div>
                  <b>{formatCLP(product.price * line.quantity)}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Tu carrito esta vacio. Vuelve al catalogo y agrega productos.</p>
        )}

        <div className="promotionBox">
          <label htmlFor="promotionCode">Codigo de descuento</label>
          <div className="promotionApplyRow">
            <input
              id="promotionCode"
              onChange={(event) => {
                setPromotionCode(event.target.value.toUpperCase());
                if (appliedPromotion) {
                  setAppliedPromotion(null);
                  setPromotionStatus(null);
                }
              }}
              value={promotionCode}
            />
            <button
              disabled={applyingPromotion || !lines.length}
              onClick={applyPromotion}
              type="button"
            >
              {applyingPromotion ? "Aplicando..." : "Aplicar"}
            </button>
          </div>
          {promotionStatus ? (
            <span className={`promotionMessage ${promotionStatus.type}`}>
              {promotionStatus.text}
            </span>
          ) : null}
        </div>

        <dl className="checkoutTotals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCLP(totals.subtotal)}</dd>
          </div>
          {totals.automaticDiscount > 0 ? (
            <div>
              <dt>Descuento automatico</dt>
              <dd>{formatCLP(totals.automaticDiscount)}</dd>
            </div>
          ) : null}
          {totals.promotionDiscount > 0 ? (
            <div>
              <dt>Codigo {appliedPromotion?.code}</dt>
              <dd>-{formatCLP(totals.promotionDiscount)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Descuento</dt>
            <dd>{formatCLP(totals.discount)}</dd>
          </div>
          <div>
            <dt>Envio</dt>
            <dd>
              {totals.shipping ? formatCLP(totals.shipping) : "Por pagar"}
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatCLP(totals.total)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
