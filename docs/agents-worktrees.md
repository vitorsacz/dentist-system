# Git Worktrees — Regra para Agentes

Cada agente trabalha em um `git worktree` próprio (diretório isolado, branch isolada).
Nunca execute `git checkout` nem `git switch` no diretório compartilhado — isso troca a branch para todos os processos que usam aquele clone.

```bash
# Criar worktree para uma branch nova
git worktree add ../dentist-<agente>-<feature> -b <branch>

# Remover ao terminar
git worktree remove ../dentist-<agente>-<feature>
```

Um worktree por agente por branch; nenhum worktree compartilha branch com outro.
