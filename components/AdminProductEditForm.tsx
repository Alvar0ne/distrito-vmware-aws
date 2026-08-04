"use client";

import { useMemo, useRef, useState } from "react";
import { shouldHideProductSizes } from "@/lib/productDisplay";
import { categories, type ProductCategory } from "@/lib/products";
import type { StoredProduct } from "@/lib/productStore";

type AdminProductEditFormProps = {
  product: StoredProduct;
  mode?: "create" | "edit";
};

type SaveStatus = "idle" | "saving" | "success" | "error";

const SIZE_OPTIONS = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL / Doble XL" }
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function cleanMoney(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatMoney(value: string) {
  if (!value) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export function AdminProductEditForm({ product, mode = "edit" }: AdminProductEditFormProps) {
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [category, setCategory] = useState<ProductCategory>(product.category);
  const [price, setPrice] = useState(String(product.price));
  const [compareAtPrice, setCompareAtPrice] = useState(
    product.compareAtPrice ? String(product.compareAtPrice) : ""
  );
  const [featured, setFeatured] = useState(product.featured ? "si" : "no");
  const [description, setDescription] = useState(product.description);
  const [images, setImages] = useState<string[]>(product.images);
  const [sizes, setSizes] = useState<string[]>(
    product.sizes.filter((size) => SIZE_OPTIONS.some((option) => option.value === size))
  );
  const [selectedSize, setSelectedSize] = useState("");
  const [stockBySize, setStockBySize] = useState<Record<string, string>>(
    Object.fromEntries(product.sizes.map((size) => [size, String(product.stockBySize[size] ?? 0)]))
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const addImageInputRef = useRef<HTMLInputElement>(null);
  const isCreateMode = mode === "create";

  const hideSizes = shouldHideProductSizes({ category, name });
  const activeSizes = hideSizes ? ["U"] : sizes;
  const availableSizes = useMemo(
    () => SIZE_OPTIONS.filter((option) => !sizes.includes(option.value)),
    [sizes]
  );

  function showMessage(nextStatus: SaveStatus, nextMessage: string) {
    setStatus(nextStatus);
    setMessage(nextMessage);
  }

  function showSuccessPopup(nextMessage: string, shouldAutoHide = true) {
    setPopupMessage(nextMessage);

    if (shouldAutoHide) {
      window.setTimeout(() => setPopupMessage(""), 2600);
    }
  }

  function addSize(value: string) {
    if (!value) return;
    setSizes((current) => uniqueValues([...current, value]));
    setStockBySize((current) => ({
      ...current,
      [value]: current[value] ?? "0"
    }));
    setSelectedSize("");
  }

  function removeSize(value: string) {
    setSizes((current) => current.filter((size) => size !== value));
  }

  function updateStock(size: string, value: string) {
    setStockBySize((current) => ({
      ...current,
      [size]: cleanMoney(value)
    }));
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("productName", name.trim() || product.name || "nuevo-producto");

    const response = await fetch(
      isCreateMode ? "/api/admin/products/images" : `/api/admin/products/${product.id}/images`,
      {
        method: "POST",
        body: formData
      }
    );
    const result = (await response.json()) as { image?: string; error?: string };

    if (!response.ok || !result.image) {
      throw new Error(result.error ?? "No se pudo subir la imagen.");
    }

    return result.image;
  }

  async function handleAddImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const uploadedImage = await uploadImage(file);
      setImages((current) => [...current, uploadedImage]);
      showMessage(
        "success",
        isCreateMode
          ? "Imagen agregada. Ahora crea el producto para guardarla en la ficha."
          : "Imagen agregada. Guarda cambios para dejarla en el producto."
      );
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
    showMessage("success", "Imagen eliminada del producto. Guarda cambios para confirmar.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    if (!hideSizes && !sizes.length) {
      showMessage("error", "Selecciona al menos una talla.");
      return;
    }

    const payload = {
      name: name.trim(),
      brand: brand.trim(),
      category,
      price: Number(price),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      featured: featured === "si",
      description: description.trim(),
      images,
      sizes: activeSizes,
      stockBySize: Object.fromEntries(
        activeSizes.map((size) => [size, Number(stockBySize[size] || 0)])
      )
    };

    try {
      const response = await fetch(isCreateMode ? "/api/admin/products" : `/api/admin/products/${product.id}`, {
        method: isCreateMode ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { product?: StoredProduct; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo guardar el producto.");
      }

      if (isCreateMode && result.product) {
        setStatus("success");
        showSuccessPopup("Producto creado exitosamente.", false);
        window.setTimeout(() => {
          window.location.href = `/admin/productos/${result.product?.id}/editar`;
        }, 900);
        return;
      }

      setStatus("success");
      showSuccessPopup("Producto guardado exitosamente.");
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "No se pudo guardar el producto.");
    }
  }

  return (
    <form className="adminEditForm" onSubmit={handleSubmit}>
      {popupMessage ? (
        <div className="adminToast" role="status">
          <strong>{popupMessage}</strong>
          <button aria-label="Cerrar aviso" onClick={() => setPopupMessage("")} type="button">
            Cerrar
          </button>
        </div>
      ) : null}

      <div className="adminEditTop">
        <div>
          <a className="backLink" href="/admin?section=productos">
            Volver a productos
          </a>
          <p className="eyebrow">{isCreateMode ? "Nuevo producto" : "Editar producto"}</p>
          <h1>{name || product.name}</h1>
          <span>
            {brand || "Sin marca"} · Stock{" "}
            {activeSizes.reduce((sum, size) => sum + Number(stockBySize[size] || 0), 0)}
          </span>
        </div>
        <button disabled={status === "saving" || uploading} type="submit">
          {status === "saving" ? "Guardando..." : isCreateMode ? "Crear producto" : "Guardar cambios"}
        </button>
      </div>

      {message ? (
        <div className={`formMessage ${status === "error" ? "error" : ""}`}>{message}</div>
      ) : null}

      <section className="adminEditGrid">
        <div className="adminEditColumn">
          <article className="adminEditPanel">
            <div className="panelHead">
              <h2>Caracteristicas</h2>
            </div>
            <div className="adminFormGrid">
              <label className="adminField">
                Nombre
                <input required value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="adminField">
                Marca
                <input value={brand} onChange={(event) => setBrand(event.target.value)} />
              </label>
              <label className="adminField">
                Tipo de producto
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ProductCategory)}
                >
                  {categories
                    .filter((item) => item.id !== "all")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="adminField">
                Precio
                <input
                  inputMode="numeric"
                  required
                  value={formatMoney(price)}
                  onChange={(event) => setPrice(cleanMoney(event.target.value))}
                />
              </label>
              <label className="adminField">
                Precio antes
                <input
                  inputMode="numeric"
                  value={formatMoney(compareAtPrice)}
                  onChange={(event) => setCompareAtPrice(cleanMoney(event.target.value))}
                />
              </label>
              <label className="adminField">
                Destacado
                <select value={featured} onChange={(event) => setFeatured(event.target.value)}>
                  <option value="si">Si</option>
                  <option value="no">No</option>
                </select>
              </label>
              {hideSizes ? null : (
                <div className="adminField adminFieldWide">
                  Tallas
                  <select value={selectedSize} onChange={(event) => addSize(event.target.value)}>
                    <option value="">Seleccionar talla</option>
                    {availableSizes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="adminSizeChips">
                    {sizes.map((size) => (
                      <button key={size} onClick={() => removeSize(size)} type="button">
                        {size === "XXL" ? "XXL / Doble XL" : size}
                        <span>Quitar</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="adminField adminFieldWide">
                Descripcion
                <textarea
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="adminEditPanel">
            <div className="panelHead">
              <h2>{hideSizes ? "Stock" : "Variantes y stock"}</h2>
            </div>
            <div className="adminVariantGrid">
              {activeSizes.map((size) => (
                <label className="adminField adminStockField" key={size}>
                  {hideSizes ? "Stock disponible" : `Talla ${size === "XXL" ? "XXL / Doble XL" : size}`}
                  <input
                    inputMode="numeric"
                    value={stockBySize[size] ?? ""}
                    onChange={(event) => updateStock(size, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>
        </div>

        <article className="adminEditPanel">
          <div className="panelHead">
            <h2>Fotos</h2>
            <button
              disabled={uploading}
              onClick={() => addImageInputRef.current?.click()}
              type="button"
            >
              {uploading ? "Subiendo..." : "Agregar imagen"}
            </button>
            <input
              ref={addImageInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="adminHiddenFile"
              onChange={handleAddImage}
              type="file"
            />
          </div>
          <div className="adminImageGrid">
            {images.length ? (
              images.map((image, index) => (
                <figure key={`${image}-${index}`}>
                  <img alt={`${name} foto ${index + 1}`} src={image} />
                  <figcaption>
                    <span>Foto {index + 1}</span>
                    <button onClick={() => removeImage(index)} type="button">
                      Eliminar
                    </button>
                  </figcaption>
                </figure>
              ))
            ) : (
              <div className="emptyAdminState">
                <strong>Sin fotos.</strong>
                <span>
                  {isCreateMode
                    ? "Puedes agregar imagenes antes de crear el producto."
                    : "Agrega una imagen desde tu computador."}
                </span>
              </div>
            )}
          </div>
        </article>
      </section>
    </form>
  );
}
