# Casa & Obra v4

## Sincronização
- Controle de `revision` no `app_state` para evitar sobrescrita silenciosa.
- Merge de conflitos por item usando `_u` (timestamp da alteração).
- Tombstones para exclusões, evitando registros apagados reaparecerem.
- Estado local não some enquanto uma atualização remota está chegando.
- Alterações offline ficam marcadas como pendentes e são reenviadas.

## Lançamentos
- Todo lançamento exige onde o valor será debitado/creditado: conta bancária, vale-refeição ou dinheiro em mãos.
- O saldo só é movimentado ao marcar como pago/recebido.
- Desfazer pagamento estorna o saldo automaticamente.
- Origem/destino aparece na lista e nos detalhes.

## Pix
- Campo separado para chave Pix (CPF, CNPJ, celular, e-mail ou aleatória).
- Pix Copia e Cola continua separado e pode preencher a chave automaticamente.

## Notificações
- Aviso ao cadastrar compromisso.
- Aviso ao cadastrar receita/despesa.
- Web Push via Supabase.
- Lembretes a cada 90 min no vencimento, começando 08:20, até marcar como pago.

## Interface
- Dados de exemplo removidos.
