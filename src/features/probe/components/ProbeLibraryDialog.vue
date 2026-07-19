<script lang="ts" setup>
import { useDialogPluginComponent, useQuasar } from "quasar";
import { InstallProbeDialog } from "@/features/probe";
import { useProbeLibraryStore } from "@/stores/probe-library.store";

const $q = useQuasar();

// Setup dialog.
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const probeLibraryStore = useProbeLibraryStore();
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

        <q-list separator>
          <q-item
            v-for="probe in probeLibraryStore.library"
            :key="`${probe.annotations!.manufacturer}-${probe.annotations!.model_name}`"
          >
            <q-item-section>{{ probe.annotations!.model_name }}</q-item-section>
            <q-item-section side>
              <q-btn flat icon="delete" round />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="Close" @click="onDialogOK" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="sass" scoped></style>
