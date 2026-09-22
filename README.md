# Órigo Asset Management

Gostaria de criar um software para a Órigo Energia para fazermos a gestão dos nosso ativos (notebooks e celulares). Hoje todas as máquinas são alugadas por uma empresa chama Simpress. Nesse sistema precisamos vincular os ativos aos usuários, assim sabemos qual usuario está usando qual máquina. Além disso quando um usuario for vinculado a um ativo automaticamente o sistema deve preencher um formulário de uso de ativo com as informações pertinentes e disparar via docusign para que o usuario assine e depois de assinar guardar esse anexo no histórico do usuario e equipamento dentro do sistema. Para todas essas integrações e execuções queremos usar o hermes-agent para executa-la porém todo o frontend será no lovable.

Coloquei em anexo um esboço que fizemos na louza, precisamos de conexão com intune e possibilidade de subida em massa de dados via planilha. Crie um sistema com a identidade da órigo, toda parte de autenticação, cadastro pelo administrador e etc.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://origoassetmanagement.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9d556ca5-67de-4695-952c-be5b3308c9c6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
