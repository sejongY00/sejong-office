<script setup lang="ts">
import type { ModelTreeNode } from '@/integrations/model3d/types';

defineOptions({ name: 'ModelTreeItem' });

const props = defineProps<{
  node: ModelTreeNode;
  depth?: number;
  selectedKey?: string | null;
  hiddenKeys?: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  select: [key: string | null];
  toggleVisible: [key: string];
}>();

function isHidden(node: ModelTreeNode) {
  if (!node.meshInstanceKey || !props.hiddenKeys) return false;
  return props.hiddenKeys.has(node.meshInstanceKey);
}

function onSelect(node: ModelTreeNode) {
  if (node.meshInstanceKey) emit('select', node.meshInstanceKey);
}
</script>

<template>
  <li class="tree-item">
    <details :open="(depth ?? 0) < 1 && node.children.length > 0">
      <summary
        :class="{
          'tree-leaf': !node.children.length,
          'tree-selected':
            node.meshInstanceKey && node.meshInstanceKey === selectedKey,
          'tree-hidden': isHidden(node),
        }"
        @click.stop="onSelect(node)"
      >
        <button
          v-if="node.meshInstanceKey"
          type="button"
          class="vis"
          :title="isHidden(node) ? '표시' : '숨기기'"
          @click.stop="emit('toggleVisible', node.meshInstanceKey!)"
        >
          {{ isHidden(node) ? '○' : '●' }}
        </button>
        <span>{{ node.name }}</span>
        <small>{{ node.type }}</small>
      </summary>
      <ul v-if="node.children.length">
        <ModelTreeItem
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :depth="(depth ?? 0) + 1"
          :selected-key="selectedKey"
          :hidden-keys="hiddenKeys"
          @select="emit('select', $event)"
          @toggle-visible="emit('toggleVisible', $event)"
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
  padding-left: 0.15rem;
}

.tree-selected span {
  color: var(--accent);
  font-weight: 600;
}

.tree-hidden span {
  opacity: 0.45;
  text-decoration: line-through;
}

.vis {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
  line-height: 1;
}
</style>
