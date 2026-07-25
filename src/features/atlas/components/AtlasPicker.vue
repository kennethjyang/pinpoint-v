<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import { useFuse } from "@vueuse/integrations/useFuse";
import {
  Atlas,
  BRAINGLOBE_BASE_URL,
  checkAtlasCompatibility,
  ConverterCompatibility,
  fetchAtlasMetadata,
  listAtlases,
  listAtlasesHTTP
} from "@/features/atlas";
import { computedAsync } from "@vueuse/core";

enum SourceToggle {
  BrainGlobe,
  Custom
}

// Props.
const selectedAtlas = defineModel<Atlas | null>({ required: true });

// Composables.

const $q = useQuasar();
const { t } = useI18n();
const favoriteAtlasesStore = useFavoriteAtlasesStore();

// State.

const sourceToggle = ref<SourceToggle>(SourceToggle.BrainGlobe);

watch(sourceToggle, newSource => {
  switch (newSource) {
    case SourceToggle.BrainGlobe:
      atlasSource.value = BRAINGLOBE_BASE_URL;
      break;
    case SourceToggle.Custom:
      atlasSource.value = "http://localhost:3000";
      break;
    default:
      atlasSource.value = BRAINGLOBE_BASE_URL;
      break;
  }
});

/**
 * Atlas source URL.
 */
const atlasSource = ref<string | null>(BRAINGLOBE_BASE_URL);

/**
 * Filter string.
 */
const searchQuery = ref<string | null>(null);

const atlasesEvaluating = ref(false);

/**
 * Full list of atlases from the source URL.
 */
const atlases = computedAsync<Atlas[]>(
  async () => {
    if (!atlasSource.value) return [];

    const fetchedAtlases =
      new URL(atlasSource.value).href === new URL(BRAINGLOBE_BASE_URL).href
        ? await listAtlases()
        : await listAtlasesHTTP(atlasSource.value);

    return fetchedAtlases ?? [];
  },
  [],
  atlasesEvaluating
);

// Getters.

/**
 * Null unwrapped search query.
 */
const unwrappedSearchQuery = computed(() => searchQuery.value ?? "");

/**
 * Favorites for this source as a set for fast lookup.
 */
const favoritesSet = computed(() => {
  // Return the source if there are atlases.
  if (atlases.value[0]) {
    const source = atlases.value[0].source;
    return new Set(favoriteAtlasesStore.favorites[source]);
  }

  // Otherwise, return the empty set.
  return new Set();
});

/**
 * Fuzzy finding results.
 */
const { results: atlasFuse } = useFuse(unwrappedSearchQuery, atlases, {
  fuseOptions: { keys: ["name"] }
});

/**
 * Switch between showing all atlases sorted or fuzzy finding results.
 */
const filteredAtlases = computed(() =>
  searchQuery.value
    ? atlasFuse.value.map(result => result.item)
    : [...atlases.value].sort((a, b) => a.name.localeCompare(b.name))
);

/**
 * Favorites from this source.
 */
const filteredFavorites = computed(() =>
  filteredAtlases.value.filter(atlas => favoritesSet.value.has(atlas.name))
);

/**
 * Non-favorite atlases from this source.
 */
const filteredNonFavorites = computed(() =>
  filteredAtlases.value.filter(atlas => !favoritesSet.value.has(atlas.name))
);

/**
 * Select an atlas, first checking that its version is compatible with the
 * running Pinpoint version. Blocks selection (and notifies) on a major
 * version mismatch or an unverifiable version; warns but still selects on a
 * minor version mismatch.
 */
async function selectAtlas(atlas: Atlas) {
  const metadata = await fetchAtlasMetadata(atlas);
  const compatibility = checkAtlasCompatibility(
    metadata?.version,
    import.meta.env.APP_VERSION
  );

  switch (compatibility) {
    case ConverterCompatibility.BlockPinpointOutdated:
      $q.notify({
        message: t("atlasPicker.pinpointOutdated"),
        caption: t("atlasPicker.pinpointOutdatedCaption"),
        color: "negative",
        icon: "error"
      });
      selectedAtlas.value = null;
      return;
    case ConverterCompatibility.BlockAtlasOutdated:
      $q.notify({
        message: t("atlasPicker.atlasOutdated"),
        caption: t("atlasPicker.atlasOutdatedCaption"),
        color: "negative",
        icon: "error"
      });
      selectedAtlas.value = null;
      return;
    case ConverterCompatibility.Unverifiable:
      $q.notify({
        message: t("atlasPicker.versionUnverifiable"),
        caption: t("atlasPicker.versionUnverifiableCaption"),
        color: "negative",
        icon: "error"
      });
      selectedAtlas.value = null;
      return;
    case ConverterCompatibility.Warn:
      $q.notify({
        message: t("atlasPicker.versionWarn"),
        caption: t("atlasPicker.versionWarnCaption"),
        color: "warning",
        icon: "warning"
      });
      break;
    case ConverterCompatibility.Compatible:
      break;
  }

  selectedAtlas.value = atlas;
}
</script>

<template>
  <q-form class="q-gutter-y-sm">
    <p class="text-h6">{{ $t("atlasPicker.title") }}</p>

    <q-btn-toggle
      v-model="sourceToggle"
      :options="[
        {
          label: $t('atlasPicker.brainglobeHosted'),
          value: SourceToggle.BrainGlobe
        },
        { label: $t('atlasPicker.customHTTPHost'), value: SourceToggle.Custom }
      ]"
      spread
      toggle-color="primary"
    />

    <q-input
      v-if="sourceToggle === SourceToggle.Custom"
      v-model="atlasSource"
      :label="$t('atlasPicker.sourceUrl')"
      class="col"
      clearable
    />

    <template v-if="atlasesEvaluating">
      <q-list separator>
        <q-item v-for="n in 5" :key="n">
          <q-item-section>
            <q-skeleton type="text" />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <template v-else>
      <template v-if="atlases.length > 0">
        <q-input
          v-model="searchQuery"
          :label="$t('atlasPicker.search')"
          clearable
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
        <p>{{
          $t(
            "atlasPicker.atlasCount",
            { count: filteredAtlases.length },
            filteredAtlases.length
          )
        }}</p>

        <q-list class="dialog-list" separator>
          <q-item
            v-for="atlas in filteredFavorites"
            :key="`${atlas.source}-${atlas.name}`"
            v-ripple
            :active="selectedAtlas === atlas"
            clickable
            @click="selectAtlas(atlas)"
          >
            <q-item-section>{{ atlas.name }}</q-item-section>
            <q-item-section side>
              <q-btn
                :aria-label="$t('atlasPicker.removeFavorite')"
                color="pink"
                flat
                icon="favorite"
                round
                @click.stop="favoriteAtlasesStore.remove(atlas)"
              />
            </q-item-section>
          </q-item>

          <q-item
            v-for="atlas in filteredNonFavorites"
            :key="`${atlas.source}-${atlas.name}`"
            v-ripple
            :active="selectedAtlas === atlas"
            clickable
            @click="selectAtlas(atlas)"
          >
            <q-item-section>{{ atlas.name }}</q-item-section>
            <q-item-section side>
              <q-btn
                :aria-label="$t('atlasPicker.addFavorite')"
                flat
                icon="favorite_border"
                round
                @click.stop="favoriteAtlasesStore.add(atlas)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </template>
      <template v-else>
        <p>No atlases found. Check your connection to the source.</p>
      </template>
    </template>
  </q-form>
</template>
