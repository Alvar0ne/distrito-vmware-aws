"use client";

import { useState } from "react";
import type { StoredCustomer } from "@/lib/customerStore";

type BrevoStatus = {
  connected: boolean;
  hasSender: boolean;
  listId: number | null;
  senderEmail: string;
  senderName: string;
};

type AdminBrevoAppPanelProps = {
  customers: StoredCustomer[];
  status: BrevoStatus;
};

type BrevoMessage = {
  type: "success" | "error";
  text: string;
};

export function AdminBrevoAppPanel({ customers, status }: AdminBrevoAppPanelProps) {
  const [message, setMessage] = useState<BrevoMessage | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingPaidOrder, setTestingPaidOrder] = useState(false);
  const [testEmail, setTestEmail] = useState(customers[0]?.email ?? "");

  async function syncContacts() {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/apps/brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "syncContacts" })
      });
      const data = (await response.json()) as {
        result?: { createdOrUpdated: number; failed: number };
        error?: string;
      };
      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "No se pudo sincronizar con Brevo.");
      }

      setMessage({
        type: "success",
        text: `Clientes sincronizados: ${data.result.createdOrUpdated}. Fallidos: ${data.result.failed}.`
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo sincronizar con Brevo."
      });
    } finally {
      setSyncing(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/apps/brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendTest", email: testEmail })
      });
      const data = (await response.json()) as {
        sent?: boolean;
        result?: { messageId?: string };
        error?: string;
      };
      if (!response.ok || !data.sent) {
        throw new Error(data.error ?? "No se pudo enviar el correo de prueba.");
      }

      setMessage({
        type: "success",
        text: data.result?.messageId
          ? `Brevo acepto el correo de prueba. ID: ${data.result.messageId}`
          : "Brevo acepto el correo de prueba."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo enviar el correo de prueba."
      });
    } finally {
      setTesting(false);
    }
  }

  async function sendPaidOrderTest() {
    setTestingPaidOrder(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/apps/brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendPaidOrderTest", email: testEmail })
      });
      const data = (await response.json()) as {
        sent?: boolean;
        result?: { messageId?: string };
        to?: string;
        error?: string;
      };
      if (!response.ok || !data.sent) {
        throw new Error(data.error ?? "No se pudo enviar el correo de pedido pagado.");
      }

      setMessage({
        type: "success",
        text: data.result?.messageId
          ? `Brevo acepto el correo de pedido pagado para ${data.to ?? testEmail}. ID: ${data.result.messageId}`
          : `Brevo acepto el correo de pedido pagado para ${data.to ?? testEmail}.`
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo enviar el correo de pedido pagado."
      });
    } finally {
      setTestingPaidOrder(false);
    }
  }

  return (
    <section className="brevoAppGrid">
      <article className="adminPanel brevoHeroPanel">
        <div>
          <p className="eyebrow">Aplicacion</p>
          <h2>Brevo</h2>
          <span>Email marketing, contactos y correos de prueba conectados a tus clientes.</span>
        </div>
        <strong className={status.connected ? "brevoStatus on" : "brevoStatus off"}>
          {status.connected ? "Conectado" : "Pendiente"}
        </strong>
      </article>

      <article className="adminPanel brevoSetupPanel">
        <div className="panelHead">
          <div>
            <h2>Configuracion</h2>
            <span>Agrega estos datos en el archivo .env para activar Brevo.</span>
          </div>
        </div>
        <div className="brevoConfigList">
          <div>
            <strong>BREVO_API_KEY</strong>
            <span>{status.connected ? "Configurada" : "Pendiente"}</span>
          </div>
          <div>
            <strong>BREVO_SENDER_EMAIL</strong>
            <span>{status.senderEmail || "Pendiente"}</span>
          </div>
          <div>
            <strong>BREVO_SENDER_NAME</strong>
            <span>{status.senderName}</span>
          </div>
          <div>
            <strong>BREVO_LIST_ID</strong>
            <span>{status.listId ?? "Opcional, recomendado"}</span>
          </div>
        </div>
      </article>

      <article className="adminPanel brevoActionsPanel">
        <div className="panelHead">
          <div>
            <h2>Contactos</h2>
            <span>{customers.length} cliente(s) registrados en tu tienda.</span>
          </div>
        </div>
        <div className="brevoActionBody">
          <p>
            Sincroniza tus clientes con Brevo para crear campanas desde el editor visual de Brevo.
            Asi usamos su entregabilidad, plantillas y estadisticas.
          </p>
          <button
            className="adminPanelAction"
            disabled={!status.connected || syncing || !customers.length}
            onClick={syncContacts}
            type="button"
          >
            {syncing ? "Sincronizando..." : "Sincronizar clientes"}
          </button>
        </div>
      </article>

      <article className="adminPanel brevoActionsPanel">
        <div className="panelHead">
          <div>
            <h2>Correo de prueba</h2>
            <span>Sirve para validar el remitente y el correo real de pago confirmado.</span>
          </div>
        </div>
        <div className="brevoActionBody">
          {!status.connected || !status.hasSender ? (
            <div className="brevoWarning">
              Para enviar correos reales debes configurar BREVO_API_KEY y BREVO_SENDER_EMAIL en
              el archivo .env, y luego reiniciar la consola.
            </div>
          ) : null}
          <label className="adminField">
            Correo destinatario
            <input
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="cliente@correo.cl"
              type="email"
              value={testEmail}
            />
          </label>
          <button
            className="adminPanelAction"
            disabled={!status.connected || !status.hasSender || testing || !testEmail}
            onClick={sendTest}
            type="button"
          >
            {testing ? "Enviando..." : "Enviar prueba"}
          </button>
          <button
            className="adminPanelAction secondary"
            disabled={!status.connected || !status.hasSender || testingPaidOrder}
            onClick={sendPaidOrderTest}
            type="button"
          >
            {testingPaidOrder ? "Enviando..." : "Probar correo pedido pagado"}
          </button>
        </div>
      </article>

      {message ? (
        <div className={`adminProductMessage ${message.type} brevoMessage`} role="status">
          {message.text}
        </div>
      ) : null}

      <article className="adminPanel brevoFlowPanel">
        <div className="panelHead">
          <div>
            <h2>Flujo recomendado</h2>
            <span>Como vamos a usar Brevo en Distrito Miami.</span>
          </div>
        </div>
        <div className="brevoFlowSteps">
          <div>
            <strong>1</strong>
            <span>Crear cuenta en Brevo y verificar el remitente.</span>
          </div>
          <div>
            <strong>2</strong>
            <span>Guardar API key y lista en el .env de la tienda.</span>
          </div>
          <div>
            <strong>3</strong>
            <span>Sincronizar clientes desde este panel.</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Crear campanas con el editor visual dentro de Brevo.</span>
          </div>
        </div>
      </article>
    </section>
  );
}
