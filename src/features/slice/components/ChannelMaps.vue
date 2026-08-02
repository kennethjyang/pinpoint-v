<script lang="ts" setup>
import { ref } from "vue";

type ChannelMapsZoom = "small" | "medium" | "large";

const zoomSelection = ref<ChannelMapsZoom>("large");
</script>

<template>
  <div class="column">
    <q-btn-toggle
      v-model="zoomSelection"
      :options="[
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' }
      ]"
      spread
      toggle-color="primary"
    />
  </div>
</template>

<style lang="sass" scoped></style>
