<script lang="ts" setup>
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import type { CoordinateSystem } from "../model/coordinate-system.model";
import { useCoordinateSystemLibraryStore } from "@/stores/coordinate-system-library.store";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const $q = useQuasar();
const { t } = useI18n();
const coordinateSystemLibraryStore = useCoordinateSystemLibraryStore();
const currentExperimentStore = useCurrentExperimentStore();

/**
 * Select a coordinate system for the inspector and close the library.
 * @param coordinateSystem Coordinate system to inspect.
 */
function openInInspector(coordinateSystem: CoordinateSystem) {
  currentExperimentStore.selectedInspectable = coordinateSystem;
  onDialogOK();
}

/**
 * Ask the user to confirm, then remove the coordinate system from the library.
 * @param coordinateSystem Coordinate system to remove.
 */
function confirmRemove(coordinateSystem: CoordinateSystem) {
  $q.notify({
    message: t("coordinateSystemLibrary.confirmDelete", {
      name: coordinateSystem.name
    }),
    color: "warning",
    icon: "warning",
    timeout: 0,
    actions: [
      { label: t("coordinateSystemLibrary.cancel"), color: "white" },
      {
        label: t("coordinateSystemLibrary.delete"),
        color: "white",
        handler: () => coordinateSystemLibraryStore.remove(coordinateSystem)
      }
    ]
  });
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card>
      <q-card-section>
        <div class="text-h5">{{ $t("coordinateSystemLibrary.title") }}</div>
        <div class="text-caption">
          {{ $t("coordinateSystemLibrary.clickToInspectHint") }}
        </div>
      </q-card-section>
      <q-card-section>
        <q-list class="dynamic-dialog-list" separator>
          <q-item
            v-for="coordinateSystem in coordinateSystemLibraryStore.library"
            :key="coordinateSystem.id"
            v-ripple
            clickable
            @click="openInInspector(coordinateSystem)"
          >
            <q-item-section>{{ coordinateSystem.name }}</q-item-section>
            <q-item-section side>
              <q-btn
                :aria-label="
                  t('coordinateSystemLibrary.deleteCoordinateSystem', {
                    name: coordinateSystem.name
                  })
                "
                flat
                icon="delete"
                round
                @click.stop="confirmRemove(coordinateSystem)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          color="primary"
          :label="$t('coordinateSystemLibrary.close')"
          @click="onDialogOK"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
