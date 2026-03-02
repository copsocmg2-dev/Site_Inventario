/* 
  Supabase Database Schema for PDA Control 
  Migration from Google Sheets to SQL
*/

-- 1. Areas
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Líderes
CREATE TABLE IF NOT EXISTS lideres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    email TEXT, -- Para login via Supabase Auth futuramente
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Estoque (Ativos)
CREATE TABLE IF NOT EXISTS estoque (
    sn TEXT PRIMARY KEY, -- Serial Number é a chave única
    modelo TEXT,
    status TEXT DEFAULT 'Disponível', -- Disponível, Emprestado, Quebrado
    observacao TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ativos Atuais (Quem está com o quê agora)
CREATE TABLE IF NOT EXISTS ativos_atuais (
    sn TEXT PRIMARY KEY REFERENCES estoque(sn) ON DELETE CASCADE,
    responsavel_id UUID REFERENCES lideres(id) ON DELETE CASCADE,
    data_atribuicao TIMESTAMPTZ DEFAULT now()
);

-- 5. Movimentações (Histórico)
CREATE TABLE IF NOT EXISTS movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sn TEXT REFERENCES estoque(sn) ON DELETE SET NULL,
    responsavel_id UUID REFERENCES lideres(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL, -- Saída, Retorno, Troca-Saída, Troca-Entrada
    data TIMESTAMPTZ DEFAULT now(),
    admin_id TEXT, -- Pode ser o e-mail do admin do Supabase Auth
    condicao TEXT,
    observacao TEXT
);

-- 6. Solicitações de Ativos
CREATE TABLE IF NOT EXISTS solicitacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ DEFAULT now(),
    lider_id UUID REFERENCES lideres(id) ON DELETE CASCADE,
    quantidade INT NOT NULL,
    status TEXT DEFAULT 'PENDENTE', -- PENDENTE, APROVADO, CONCLUIDO, REJEITADO
    observacao TEXT,
    observacao_admin TEXT
);

-- 7. Trocas entre Líderes
CREATE TABLE IF NOT EXISTS trocas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ DEFAULT now(),
    lider_origem UUID REFERENCES lideres(id),
    lider_destino UUID REFERENCES lideres(id),
    sns TEXT[], -- Array de SNs envolvidos
    status_origem TEXT DEFAULT 'ACEITO',
    status_destino TEXT DEFAULT 'PENDENTE',
    status_geral TEXT DEFAULT 'AGUARDANDO' -- AGUARDANDO, PENDENTE_ADMIN, CONCLUIDO, CANCELADO
);

-- 8. Planejamento (Metas por Turno)
CREATE TABLE IF NOT EXISTS planejamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    turno TEXT NOT NULL, -- T1, T2, T3
    area_id UUID REFERENCES areas(id),
    quantidade INT DEFAULT 0,
    UNIQUE(data, turno, area_id)
);

-- ==========================================
-- DADOS FICTÍCIOS PARA TESTE (SEED DATA)
-- ==========================================

-- Inserindo Áreas
INSERT INTO areas (nome) VALUES 
('Recebimento'), 
('Expedição'), 
('Esteira'), 
('Retorno'),
('Inventário')
ON CONFLICT DO NOTHING;

-- Inserindo Líderes (Pegando IDs das áreas)
DO $$
DECLARE 
    area_rec_id UUID := (SELECT id FROM areas WHERE nome = 'Recebimento');
    area_exp_id UUID := (SELECT id FROM areas WHERE nome = 'Expedição');
BEGIN
    INSERT INTO lideres (nome, area_id) VALUES 
    ('Líder João Silva', area_rec_id),
    ('Líder Maria Oliveira', area_exp_id),
    ('Líder Carlos Souza', area_rec_id)
    ON CONFLICT DO NOTHING;
END $$;

-- Inserindo Ativos no Estoque
INSERT INTO estoque (sn, modelo, status, observacao) VALUES 
('PDA001', 'Zebra TC21', 'Disponível', 'Bateria nova'),
('PDA002', 'Zebra TC21', 'Disponível', ''),
('PDA003', 'Honeywell EDA51', 'Quebrado', 'Tela trincada'),
('PDA004', 'Zebra TC21', 'Emprestado', ''),
('PDA005', 'Honeywell EDA51', 'Disponível', '')
ON CONFLICT DO NOTHING;

-- Atribuindo Ativo ao Líder João (PDA004)
DO $$
DECLARE 
    lider_id UUID := (SELECT id FROM lideres WHERE nome = 'Líder João Silva');
BEGIN
    INSERT INTO ativos_atuais (sn, responsavel_id) VALUES 
    ('PDA004', lider_id)
    ON CONFLICT DO NOTHING;
END $$;

-- Planejamento de Hoje
DO $$
DECLARE 
    area_rec_id UUID := (SELECT id FROM areas WHERE nome = 'Recebimento');
    area_exp_id UUID := (SELECT id FROM areas WHERE nome = 'Expedição');
BEGIN
    INSERT INTO planejamento (data, turno, area_id, quantidade) VALUES 
    (CURRENT_DATE, 'T1', area_rec_id, 10),
    (CURRENT_DATE, 'T1', area_exp_id, 15),
    (CURRENT_DATE, 'T2', area_rec_id, 8)
    ON CONFLICT DO NOTHING;
END $$;
