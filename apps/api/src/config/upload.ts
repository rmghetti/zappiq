/**
 * Limite de upload do Treinar IA, num lugar só.
 *
 * Dois pontos precisam do MESMO número: o multer da rota de documentos
 * (apps/api/src/routes/aiTraining.ts), que corta o envio, e o errorHandler
 * (apps/api/src/middleware/errorHandler.ts), que escreve a mensagem de 413 que
 * o cliente lê. Enquanto eram duas constantes, o número da mensagem podia
 * discordar do limite que estava valendo, e o cliente era mandado procurar um
 * problema que não existia.
 *
 * 20 MB é suficiente para contratos e FAQs extensos.
 *
 * AI_TRAINING_MAX_UPLOAD_MB existe só para o teste de rota poder provar o 413
 * sem trafegar 20 MB por loopback. Em produção a variável não é definida e vale
 * o default.
 */
export const MAX_UPLOAD_MB = Number(process.env.AI_TRAINING_MAX_UPLOAD_MB) || 20;

/** O mesmo limite em bytes, que é o que o multer espera em `limits.fileSize`. */
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
