<script lang="ts" setup>
import { useQuasar } from "quasar";
import {
  buildProbe,
  Probe,
  ProbeLibraryDialog,
  rotateProbeVisibility
} from "@/features/probe";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const $q = useQuasar();
const probeLibrary = useProbeLibraryStore();
const currentExperiment = useCurrentExperimentStore();

/**
 * Convert probe visibility state to icon name.
 * @param probe Probe to extract visibility info from.
 */
function probeVisibilityIcon(probe: Probe): string {
  switch (probe.visibility) {
    case "visible":
      return "sym_o_visibility";
    case "shanks":
      return "sym_o_undereye";
    case "hidden":
      return "sym_o_visibility_off";
    default:
      return "sym_o_visibility";
  }
}
</script>

<template>
  <div class="column">
    <q-btn-dropdown color="primary" dropdown-icon="add" label="Add Probe">
      <q-list>
        <q-item
          v-for="probeInterfaceProbe of probeLibrary.library"
          v-close-popup
          v-ripple
          clickable
          @click="
            currentExperiment.addProbe(
              buildProbe(
                currentExperiment.internProbeInterfaceProbe(probeInterfaceProbe)
              )
            )
          "
        >
          <q-item-section>
            {{ probeInterfaceProbe.annotations!.manufacturer }}
            {{ probeInterfaceProbe.annotations!.model_name }}
          </q-item-section>
        </q-item>
        <q-separator />
        <q-item
          v-close-popup
          clickable
          @click="$q.dialog({ component: ProbeLibraryDialog })"
        >
          <q-item-section>
            <q-item-label><b>Manage probes...</b></q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
    <q-list separator>
      <q-item
        v-for="probe of currentExperiment.probes"
        :key="probe.name"
        v-ripple
        :active="currentExperiment.isInspectableSelected(probe)"
        clickable
        @click="currentExperiment.selectedInspectable = probe"
      >
        <q-item-section side>
          <q-icon :style="{ color: probe.color }" name="radio_button_checked" />
        </q-item-section>
        <q-item-section>{{ probe.name }}</q-item-section>
        <q-item-section side>
          <div class="row">
            <q-btn
              :icon="probeVisibilityIcon(probe)"
              class="probe--visibility-button"
              flat
              round
              @click.stop="rotateProbeVisibility(probe)"
            />
            <q-btn
              flat
              round
              icon="delete"
              @click.stop="currentExperiment.removeProbe(probe)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style lang="sass" scoped>
.probe--visibility-button
  font-variation-settings: 'FILL' 1
</style>
