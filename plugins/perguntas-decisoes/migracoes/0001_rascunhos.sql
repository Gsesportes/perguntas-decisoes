CREATE TABLE formularios (
  id TEXT PRIMARY KEY,
  dono TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  definicao TEXT NOT NULL,
  rascunho TEXT NOT NULL,
  entrega TEXT,
  criado_em TEXT NOT NULL
);
CREATE INDEX formularios_por_dono ON formularios(dono, criado_em);
