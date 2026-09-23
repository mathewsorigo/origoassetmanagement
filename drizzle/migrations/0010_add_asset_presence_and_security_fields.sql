ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_seen_location text,
  ADD COLUMN IF NOT EXISTS bitdefender_installed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assets.intune_last_sync IS 'Timestamp do último check-in informado pelo Microsoft Intune.';
COMMENT ON COLUMN public.assets.last_seen_location IS 'Localidade aproximada mais recente informada pela integração de gestão do dispositivo.';
COMMENT ON COLUMN public.assets.bitdefender_installed IS 'Indica se o agente Bitdefender foi detectado no último sincronismo.';

CREATE INDEX IF NOT EXISTS assets_intune_last_sync_idx ON public.assets (intune_last_sync DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS assets_bitdefender_installed_idx ON public.assets (bitdefender_installed);