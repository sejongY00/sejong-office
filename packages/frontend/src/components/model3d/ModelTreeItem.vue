<script setup lang="ts">
import type { ModelTreeNode } from '@/integrations/model3d/types';

defineOptions({ name: 'ModelTreeItem' });

defineProps<{
  node: ModelTreeNode;
  depth?: number;
}>();
</script>

<template>
  <li class="tree-item">
    <details :open="(depth ?? 0) < 1 && node.children.length > 0">
      <summary :class="{ 'tree-leaf': !node.children.length }">
        <span>{{ node.name }}</span>
        <small>{{ node.type }}</small>
      </summary>
      <ul v-if="node.children.length">
        <ModelTreeItem
          v-for="(child, index) in node.children"
          :key="`${child.name}-${index}`"
          :node="child"
          :depth="(depth ?? 0) + 1"
        />
      </ul>
    </details>
  </li>
</template>

<style scoped>
.tree-item,
.tree-item ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tree-item ul {
  padding-left: 0.8rem;
  border-left: 1px solid var(--border);
}

summary {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.18rem 0;
  cursor: pointer;
  font-size: 0.76rem;
}

summary span {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

summary small {
  color: var(--muted);
  font-size: 0.66rem;
}

.tree-leaf {
  padding-left: 0.9rem;
  cursor: default;
  list-style: none;
}
</style>
