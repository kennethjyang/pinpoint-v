<script lang="ts" setup>
/**
 * @file Atlas picker interface.
 *
 * Handles connecting to an atlas source, picking an atlas, and managing favorites.
 */

import { ref } from "vue";
import { useQuasar } from "quasar";
import { api } from "@/boot/axios.boot";

/**
 * Atlas source connection status.
 */
enum ConnectionStatus {
  Disconnected,
  Connecting,
  Connected
}

/**
 * Atlas item in response structure.
 */
interface AtlasItem {
  name: string;
  type: string;
}

/**
 * Atlas source connection response.
 */
interface AtlasSourceResponse {
  files: AtlasItem[];
}

const $q = useQuasar();

// Atlas source connection state.
const atlasSource = ref<string | null>("http://localhost:3000");
const connectionStatus = ref<ConnectionStatus>(ConnectionStatus.Disconnected);

// Atlas selection state.
const atlas = ref<string | null>(null);
let atlases = ref<string[]>([]);
let favorites = ref<string[]>([]);

async function connect() {
  // Disconnect if no source.
  if (!atlasSource.value) {
    connectionStatus.value = ConnectionStatus.Disconnected;
    return;
  }

  // Set to connecting.
  connectionStatus.value = ConnectionStatus.Connecting;

  try {
    // Make a connection.
    const response = await api.get<AtlasSourceResponse>(atlasSource.value);

    // Parse the response.
    if (response.data) {
      atlases.value = response.data.files
        .filter(item => item.type === "folder")
        .map(item => item.name);
      connectionStatus.value = ConnectionStatus.Connected;
    } else {
      notifyFail();
    }
  } catch (e) {
    notifyFail();
  }

  /**
   * Notify if a connection fails and set the connection status to disconnected.
   */
  function notifyFail() {
    $q.notify({
      message: "Unable to access atlases from source.",
      caption: "Check source URL and try again.",
      color: "negative",
      icon: "mobiledata_off"
    });
    connectionStatus.value = ConnectionStatus.Disconnected;
  }
}

/**
 * Swaps the selected atlas between the favorites list and the general list.
 */
function swapSelectedAtlas() {
  if (!atlas.value) return;
  const selectedAtlas = atlas.value;

  // Index in each.
  const atlasesIndex = atlases.value.indexOf(selectedAtlas);
  const favoritesIndex = favorites.value.indexOf(selectedAtlas);

  // Swap.
  if (atlasesIndex !== -1) {
    atlases.value.splice(atlasesIndex, 1);
    favorites.value.push(selectedAtlas);
  } else {
    favorites.value.splice(favoritesIndex, 1);
    atlases.value.push(selectedAtlas);
  }
}
</script>

<template>
  <q-form class="picker-form q-gutter-y-sm">
    <p class="text-h6">Atlas Source</p>

    <div class="row q-gutter-x-md">
      <q-btn
        color="primary"
        icon="public"
        label="Pinpoint Atlases"
        @click="
          atlasSource =
            'https://virtualbrainlab.alleninstitute.org/pinpoint/atlases'
        "
      />
      <q-btn
        icon="home"
        label="Locally Hosted"
        @click="atlasSource = 'http://localhost:3000'"
      />
    </div>

    <q-input v-model="atlasSource" class="col" clearable label="Source URL" />

    <q-btn
      :loading="connectionStatus === ConnectionStatus.Connecting"
      color="primary"
      label="Connect"
      @click="connect"
    />

    <div
      v-if="connectionStatus === ConnectionStatus.Connected"
      class="row items-center q-gutter-x-md no-wrap"
    >
      <div class="atlas-column column">
        <p class="text-subtitle1">Atlases</p>
        <q-list class="atlas-list" separator>
          <q-item
            v-for="atlasName in atlases"
            v-ripple
            :active="atlasName === atlas"
            clickable
            @click="atlas = atlasName"
          >
            <q-item-section>
              {{ atlasName }}
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <q-btn color="primary" icon="swap_horiz" @click="swapSelectedAtlas" />

      <div class="atlas-column column">
        <p class="text-subtitle1">Favorites</p>
        <q-list class="atlas-list" separator>
          <q-item
            v-for="atlasName in favorites"
            v-ripple
            :active="atlasName === atlas"
            clickable
            @click="atlas = atlasName"
          >
            <q-item-section>
              {{ atlasName }}
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>
  </q-form>
</template>

<style lang="sass" scoped>
.picker-form
  width: fit-content

.atlas-column
  flex: 1 1 0

.atlas-list
  max-height: 30vh
  overflow-y: auto
</style>
