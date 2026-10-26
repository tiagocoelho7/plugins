# GOTB — custódia da baseline v3.0.10

**Estado da importação:** preparação em branch isolada, **HOLD até inclusão integral e verificação do código**. Nenhum merge, tag, release ou runtime autorizado.

## Fonte canônica aprovada (GO FINAL histórico)

| Artefato | SHA-256 verificado localmente |
|---|---|
| `groups-on-the-bar-firefox-source-v3.0.10.zip` | `bc566e41ad7f5129bfe73ceac430764bcef47d79a52560ed8564b974fce7a57e` |
| `groups-on-the-bar-firefox-v3.0.10.xpi` | `957ed198676a074f8f2531d2b72b0b087e78dc84c7285b6964b4c329bea1463a` |

A inspeção local identificou **74 arquivos fonte** e **38 arquivos XPI**; os 38 arquivos XPI coincidem byte a byte com os correspondentes no source. CRC íntegro, sem caminhos inseguros, entradas duplicadas ou symlinks. Os ZIPs/XPI originais devem ser guardados fora do Git público: registrar seus hashes não equivale a recriar esses bytes.

## Critérios para aceitar o PR

1. Importar exatamente os **74 arquivos fonte** em `groups-on-the-bar/`, preservando cada byte e os modos executáveis originais (7 scripts); o diretório original do ZIP serve apenas como raiz de extração.
2. Verificar hashes individuais contra um manifesto gerado diretamente do ZIP original, sem alterar código congelado, compilar, executar Firefox ou testes de browser.
3. Não incluir Diagnostic1/Diagnostic2, soak harness, GUARDED, M1 Lab, v4/P000, perfis de Firefox, segredos ou logs privados.
4. Conferir ausência de segredos e dados particulares antes de qualquer merge público; `tests/background.test.js` contém caminhos locais literais em testes.
5. Não adicionar `LICENSE` por iniciativa própria (o material não contém licença explícita) e não transformar o GO histórico em nova homologação funcional.
6. Manter o PR como **draft** até revisão do Master de Infraestrutura e autorização explícita do proprietário para merge. **Releases/tags não estão autorizados.**

**Nota de transporte:** o pacote de importação preparado pelo Master traz ZIP/XPI originais, `PAYLOAD/groups-on-the-bar/` com todos os arquivos, manifesto SHA-256 e verificador de integridade. Esta documentação isolada **não é prova de que o payload já esteja no GitHub**.

Responsabilidades: Master de Infraestrutura = custódia/branches/PRs; Master Técnico GOTB = decisões funcionais e gates.
