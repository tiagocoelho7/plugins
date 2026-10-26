# GOTB — preparação do ambiente Codex Cloud

**Status:** instruções prontas; a criação/publicação do ambiente depende do proprietário no app/web do Codex. Este documento não confirma que um ambiente Cloud já exista.

## Configuração recomendada
- **Nome sugerido:** `plugins-gotb`.
- **Repositório:** `tiagocoelho7/plugins`, branch de referência `main`.
- **Acesso:** pessoal/privado (*Only me*), sem compartilhar por padrão.
- **Ferramentas:** Git, Node.js LTS, Python 3.10+ e Bash. O projeto original não contém `package.json`; seu build usa Python padrão e seus testes usam Node nativo.
- **Instalação:** não executar `npm install`, `pip install` nem scripts de instalação visual por padrão. Não há serviço persistente para iniciar; deixar *Start skill* sem servidor.
- **Credenciais:** nenhuma chave, token, perfil Firefox ou segredo adicional é necessário para inspeção estática. Evitar rede de saída para tarefas offline; acesso a GitHub permanece sujeito à conexão do Codex.
- **Restrições:** nenhuma instalação/execução de Firefox real, geckodriver, installers macOS/Windows/Linux, AMO, releases ou operações externas.

## Como criar (interface Codex)
1. No app/web do Codex: `Work in > Cloud > Select environment > Create environment`, ou `Settings > Codex Cloud > Environments > Create environment`.
2. Conectar a conta GitHub adequada e selecionar somente `tiagocoelho7/plugins`. Solicitar que o Codex prepare **apenas as ferramentas de leitura e análise local**, sem execução de navegador.
3. Conferir relatório e políticas de acesso, salvar e publicar o ambiente quando estiver correto. A conexão GitHub deste chat **não publica** o ambiente Codex automaticamente.

Guia oficial: https://developers.openai.com/codex/environments/cloud-environments

## Checagens seguras de preparação
Apenas verificar disponibilidade das ferramentas e estado de checkout, em workspace isolado:

```bash
git status --short
git rev-parse HEAD
node --version
python3 --version
bash --version
```

O README original documenta, para tarefas de testes **explicitamente autorizadas**, os seguintes comandos locais a partir de `groups-on-the-bar/`:

```bash
node --test tests/*.test.js
python3 build.py --check-reproducible
```

O segundo comando **grava artefatos em `dist/`**; não é pré-requisito para reconhecer o ambiente e não autoriza release. Testes unitários simulados não substituem Firefox real ou auditoria independente.

## Primeira missão de reconhecimento no Cloud (somente leitura)
> Examine `tiagocoelho7/plugins`, especialmente `AGENTS.md`, `docs/gotb/` e `groups-on-the-bar/`. Confirme versão no manifesto, 74 arquivos, sete modos executáveis, árvore Git da baseline e comandos de teste; identifique dependências e potenciais limitações do Codex Cloud. Não edite arquivos, não execute testes, builds, Firefox, instaladores nem sistemas externos. Não crie branch, PR, tag ou release. Entregue apenas um relatório de reconhecimento com evidências e dúvidas, sem declarar novo GO funcional.

## Critérios de aceitação do ambiente
- Repositório certo visível; `main` acessível; nenhum outro repositório misturado.
- Ferramentas reconhecidas; nenhum token extra, instalação desnecessária, perfil real ou credencial privada adicionada.
- Baseline `groups-on-the-bar/` intacta. Dados históricos dos laboratórios não foram importados.
- Ambiente publicado pelo proprietário e missão inicial concluída em modo de leitura antes de novas tarefas de desenvolvimento.
