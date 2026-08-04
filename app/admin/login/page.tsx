"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password")
        })
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "No se pudo iniciar sesion.");
        return;
      }

      window.location.assign("/admin");
    } catch {
      setError("No se pudo conectar. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="adminLoginPage">
      <section className="adminLoginPanel">
        <Image
          alt="Distrito Miami"
          className="adminLoginLogo"
          height={112}
          priority
          src="/distrito-miami-logo.png"
          width={112}
        />
        <div>
          <p className="eyebrow">Panel privado</p>
          <h1>Administracion</h1>
          <p className="adminLoginIntro">Ingresa tus credenciales para continuar.</p>
        </div>

        <form className="adminLoginForm" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input autoComplete="username" name="username" required type="text" />
          </label>
          <label>
            Clave
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          {error ? <p className="adminLoginError" role="alert">{error}</p> : null}
          <button disabled={submitting} type="submit">
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <a className="adminLoginBack" href="/">Volver a la tienda</a>
      </section>
    </main>
  );
}
