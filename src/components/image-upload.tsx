import { useEffect, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type ImageUploadProps = {
  currentUrl?: string;
  onChange: (url: string) => void;
  folder: "vehicles" | "chargers" | "pdf";
  label?: string;
};

export function ImageUpload({ currentUrl, onChange, folder, label = "Image" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buffer local pour le champ URL : la preview reflète immédiatement ce que
  // l'utilisateur tape, sans attendre le round-trip Supabase. La valeur est
  // remontée au parent via onChange après 500ms d'inactivité.
  const [urlDraft, setUrlDraft] = useState(currentUrl ?? "");
  const lastCommittedRef = useRef(currentUrl ?? "");
  useEffect(() => {
    // Sync depuis l'extérieur uniquement quand la valeur externe diverge de
    // notre dernier commit (refetch d'une autre source, reset, etc.).
    const ext = currentUrl ?? "";
    if (ext !== lastCommittedRef.current) {
      lastCommittedRef.current = ext;
      setUrlDraft(ext);
    }
  }, [currentUrl]);
  useEffect(() => {
    if (urlDraft === lastCommittedRef.current) return;
    const t = setTimeout(() => {
      lastCommittedRef.current = urlDraft;
      onChange(urlDraft);
    }, 500);
    return () => clearTimeout(t);
  }, [urlDraft, onChange]);
  // Preview affichée : on privilégie le draft (réactif) au currentUrl (latence DB).
  const displayUrl = urlDraft || currentUrl;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 5 Mo)");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Format non supporté (PNG, JPEG ou WebP uniquement)");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Essaie 'vehicle-images' d'abord, fallback sur 'documents' si le bucket
    // n'existe pas (les deux acceptent les images).
    let bucketUsed = "vehicle-images";
    let result = await supabase.storage
      .from(bucketUsed)
      .upload(fileName, file, { upsert: false, contentType: file.type });

    if (result.error && (result.error.message?.toLowerCase().includes("bucket") || result.error.message?.toLowerCase().includes("not found"))) {
      console.warn("[upload] Bucket vehicle-images indisponible, fallback sur 'documents'");
      bucketUsed = "documents";
      result = await supabase.storage
        .from(bucketUsed)
        .upload(fileName, file, { upsert: false, contentType: file.type });
    }

    if (result.error) {
      console.error("[upload] Échec :", result.error);
      let msg = result.error.message;
      if (msg?.toLowerCase().includes("policy") || msg?.toLowerCase().includes("permission")) {
        msg = "Permissions insuffisantes — vérifiez que votre compte a role='admin' dans la table profiles.";
      } else if (msg?.toLowerCase().includes("bucket") || msg?.toLowerCase().includes("not found")) {
        msg = "Aucun bucket de stockage configuré. Lancez le SQL 005_image_buckets.sql sur Supabase.";
      } else if (msg?.toLowerCase().includes("size") || msg?.toLowerCase().includes("payload")) {
        msg = "Fichier trop volumineux (max 5 Mo).";
      }
      toast.error(`Échec upload : ${msg}`);
      setUploading(false);
      return;
    }

    if (!result.data) {
      toast.error("Upload échoué : aucune donnée retournée");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucketUsed).getPublicUrl(result.data.path);
    lastCommittedRef.current = urlData.publicUrl;
    setUrlDraft(urlData.publicUrl);
    onChange(urlData.publicUrl);
    toast.success(`Image uploadée (${bucketUsed})`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Label className="text-[10px] text-muted-foreground uppercase">{label}</Label>

      {displayUrl && (
        <div className="relative inline-block">
          <img
            src={displayUrl}
            alt="Aperçu"
            className="h-24 w-32 object-contain rounded-md border border-border bg-muted"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 bg-background border border-border rounded-full"
            onClick={() => { lastCommittedRef.current = ""; setUrlDraft(""); onChange(""); }}
            title="Retirer l'image"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2 h-8 text-xs"
        >
          <Upload className="w-3 h-3" />
          {uploading ? "Upload..." : currentUrl ? "Remplacer" : "Téléverser une image"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowUrlInput((v) => !v)}
          className="gap-2 h-8 text-xs"
        >
          <ImageIcon className="w-3 h-3" />
          {showUrlInput ? "Masquer URL" : "Coller une URL"}
        </Button>
      </div>

      {showUrlInput && (
        <Input
          type="text"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="https://... ou /images/..."
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}
