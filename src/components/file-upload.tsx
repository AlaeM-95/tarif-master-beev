import { useRef, useState } from "react";
import { Upload, FileText, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type FileUploadProps = {
  currentUrl?: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  accept?: string;
  maxSizeMb?: number;
  helper?: string;
};

const DEFAULT_ACCEPT = "application/pdf,image/png,image/jpeg";
const DEFAULT_MAX = 10;

export function FileUpload({ currentUrl, onChange, folder, label = "Document", accept = DEFAULT_ACCEPT, maxSizeMb = DEFAULT_MAX, helper }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${maxSizeMb} Mo)`);
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "pdf";
    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 40);
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;

    const { data, error } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: false, contentType: file.type });

    if (error) {
      toast.error(`Échec upload : ${error.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(data.path);
    onChange(urlData.publicUrl);
    toast.success("Document uploadé");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileName = currentUrl ? currentUrl.split("/").pop()?.split("?")[0] ?? "Document" : null;

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>

      {currentUrl ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <FileText className="w-4 h-4 text-[#5F5F64] flex-shrink-0" />
          <span className="text-xs truncate flex-1" title={fileName ?? ""}>{fileName}</span>
          <Button asChild variant="ghost" size="icon" className="h-6 w-6" title="Ouvrir">
            <a href={currentUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onChange("")}
            title="Retirer"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : null}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
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
          {uploading ? "Upload..." : currentUrl ? "Remplacer le document" : "Téléverser un document"}
        </Button>
        {helper && <p className="text-[11px] text-muted-foreground mt-1">{helper}</p>}
      </div>
    </div>
  );
}
