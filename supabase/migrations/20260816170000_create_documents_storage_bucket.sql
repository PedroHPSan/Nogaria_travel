-- =========================================================================
-- SUPABASE STORAGE BUCKET: trip-documents
-- =========================================================================

-- Inserir o bucket público/seguro se ainda não existir
insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', true)
on conflict (id) do nothing;

-- Política de leitura: autenticados podem ver objetos do bucket
create policy "Authenticated users can read trip documents"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'trip-documents');

-- Política de escrita: autenticados podem enviar arquivos para o bucket
create policy "Authenticated users can upload trip documents"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'trip-documents');

-- Política de atualização: autenticados podem atualizar arquivos no bucket
create policy "Authenticated users can update trip documents"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'trip-documents');

-- Política de deleção: autenticados podem deletar arquivos no bucket
create policy "Authenticated users can delete trip documents"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'trip-documents');
