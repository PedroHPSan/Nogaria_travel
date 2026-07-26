/**
 * Identificador único para entidades novas.
 * Substitui o padrão `prefix-${Date.now()}`, que colide quando vários
 * registros nascem no mesmo milissegundo — o que acontece toda vez que a
 * pesquisa de preços devolve vários candidatos de uma só chamada.
 */
export const newId = (): string => crypto.randomUUID();
