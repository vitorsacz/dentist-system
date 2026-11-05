import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateOrganizationProfileSchema, type UpdateOrganizationProfileInput } from "@dentist-system/shared-types";
import { myClinicApi } from "./api";

const LOGO_MAX_BYTES = 300 * 1024;

export function ClinicProfilePage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const { data: clinic, isLoading } = useQuery({
    queryKey: ["my-clinic"],
    queryFn: myClinicApi.get,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UpdateOrganizationProfileInput>({
    resolver: zodResolver(updateOrganizationProfileSchema),
  });

  const [initialized, setInitialized] = useState(false);
  if (clinic && !initialized) {
    reset({
      name: clinic.name,
      phone: clinic.phone ?? undefined,
      email: clinic.email ?? undefined,
      address: clinic.address ?? undefined,
      logoDataUrl: clinic.logoDataUrl ?? undefined,
    });
    if (clinic.logoDataUrl) setLogoPreview(clinic.logoDataUrl);
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: myClinicApi.update,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-clinic"] });
    },
  });

  const [saved, setSaved] = useState(false);

  const onSubmit = async (data: UpdateOrganizationProfileInput) => {
    await mutation.mutateAsync(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setLogoError("Apenas PNG ou JPEG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Logo deve ter no máximo 300 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setValue("logoDataUrl", dataUrl, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setValue("logoDataUrl", null, { shouldDirty: true });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-ink">Perfil da clínica</h1>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Nome</label>
          <input
            {...register("name")}
            type="text"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Telefone</label>
          <input
            {...register("phone")}
            type="text"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">E-mail</label>
          <input
            {...register("email")}
            type="email"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Endereço</label>
          <textarea
            {...register("address")}
            rows={3}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Logo</label>
          {logoPreview ? (
            <div className="mb-2 flex items-center gap-3">
              <img src={logoPreview} alt="Logo preview" className="h-16 w-auto rounded border border-line object-contain" />
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-xs text-red-500 hover:underline"
              >
                Remover
              </button>
            </div>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFile}
            className="text-sm text-ink"
          />
          {logoError && <p className="mt-1 text-xs text-red-500">{logoError}</p>}
          {errors.logoDataUrl && <p className="mt-1 text-xs text-red-500">{errors.logoDataUrl.message}</p>}
          <p className="mt-1 text-xs text-muted">PNG ou JPEG, máximo 300 KB</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {isSubmitting ? "Salvando…" : "Salvar"}
          </button>
          {saved && <span className="text-sm text-green-600">Salvo com sucesso.</span>}
          {mutation.isError && <span className="text-sm text-red-500">Erro ao salvar.</span>}
        </div>
      </form>
    </div>
  );
}
