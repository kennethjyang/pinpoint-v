<script lang="ts" setup>
import { useDialogPluginComponent, useQuasar } from "quasar";
import { InstallProbeDialog } from "@/features/probe";

const $q = useQuasar();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card>
      <q-card-section>
        <p class="text-h5">Probe Library</p>

        <q-btn
          icon="add"
          label="Install Probe"
          @click="$q.dialog({ component: InstallProbeDialog })"
        />

        <q-list separator> </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="Close" @click="onDialogOK" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="sass" scoped></style>
