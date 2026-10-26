# GOTB — custódia e continuidade técnica

**Separação de responsabilidades:** este repositório guarda código e infraestrutura. O Master Técnico GOTB mantém a autoridade sobre requisitos, diagnósticos, testes e gates. Codex executa apenas tarefas autorizadas; o proprietário decide merges e publicações.

## Versão estável importada
- **GOTB v3.0.10**: último GO FINAL histórico conhecido, sem inferir nova homologação.
- ZIP fonte original, SHA-256: `bc566e41ad7f5129bfe73ceac430764bcef47d79a52560ed8564b974fce7a57e`.
- XPI original, SHA-256: `957ed198676a074f8f2531d2b72b0b087e78dc84c7285b6964b4c329bea1463a`.
- `groups-on-the-bar/`: **74 arquivos**, sete modos executáveis; Git tree `b57ec82f8d081ff8066398b3a0367d96b12c5f98`.
- PR de importação: https://github.com/tiagocoelho7/plugins/pull/1; merge commit `c494b5231073da1a3a127d81cebcfab0ac957b02`.
- Custódia detalhada: `docs/gotb/BASELINE_v3.0.10_IMPORT.md`. Os arquivos ZIP/XPI originais e pacotes internos de auditoria **não devem ser copiados automaticamente ao Git público**.

## Frentes posteriores — NÃO confundir com baseline
- **v3.0.10.1 Diagnostic1:** HOLD/rejeitada historicamente.
- **v3.0.10.2 Diagnostic2:** GO diagnóstico condicionado, **não é release** nem substitui a v3.0.10.
- **GOTB DEV164 / GUARDED:** estudo de harness independente; aprovação histórica limitada a fase de auditoria offline A/B, não a Firefox real.
- **M1-LAB V21 (registro de 23/10/2026):** `P0_HOLD / P1_NOT_AUTHORIZED / HOLD_BEFORE_REAL_RUN`. É um registro de custódia e não uma autorização operacional. A posição mais nova deve ser comprovada pelo Master Técnico e pelos artefatos, nunca presumida.
- **v4/P000:** frente separada e sem autorização de desenvolvimento/teste por este handoff.

## Regras para o próximo ciclo
1. Primeiro reconhecer a baseline em modo de leitura; registrar versões, limites do runtime, ferramentas e evidências.
2. Antes de avançar em diagnóstico/QA, receber escopo e artefatos completos do Master Técnico, com verificação de integridade e separação das versões.
3. Para qualquer alteração futura: branch/PR isolado, hashes e testes de regressão proporcionais, auditores independentes nos gates definidos, nenhum merge/release sem autorização do proprietário.
4. Não executar Firefox real, perfis, geckodriver, instaladores visuais nem testes prolongados a partir deste documento.
5. Preservar histórico, decisões pendentes e ressalvas; ausência de evidência permanece pendência, não PASS.

**Estado:** pronto para reconhecimento Codex Cloud, sem novo GO funcional ou autorização de execução experimental.
