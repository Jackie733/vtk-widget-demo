<script setup lang="ts">
import { Maybe } from '@/src/types';
import { LPSAxis } from '@/src/types/lps';
import { inject, toRefs, watchEffect } from 'vue';
import { useImage } from '@/src/composables/useCurrentImage';
import { useSliceConfig } from '@/src/composables/useSliceConfig';
import { useWindowingConfig } from '@/src/composables/useWindowingConfig';
import { useSliceRepresentation } from '@/src/core/vtk/useSliceRepresentation';
import { SlicingMode } from '@kitware/vtk.js/Rendering/Core/ImageMapper/Constants';
import { vtkFieldRef } from '@/src/core/vtk/vtkFieldRef';
import { syncRefs } from '@vueuse/core';
import { VtkViewContext } from './context';

interface Props {
  viewId: string;
  imageId: Maybe<string>;
  axis: LPSAxis;
}

const props = defineProps<Props>();
const { viewId: viewID, imageId: imageID, axis } = toRefs(props);

const view = inject(VtkViewContext);
if (!view) throw new Error('No VtkView');

const { metadata: imageMetadata, imageData } = useImage(imageID);

const sliceConfig = useSliceConfig(viewID, imageID);
const wlConfig = useWindowingConfig(viewID, imageID);

const sliceRep = useSliceRepresentation(view, imageData);

// set slice ordering to be in the back
sliceRep.mapper.setResolveCoincidentTopologyToPolygonOffset();
sliceRep.mapper.setResolveCoincidentTopologyPolygonOffsetParameters(1, 1);

watchEffect(() => {
  const { lpsOrientation } = imageMetadata.value;
  const ijkIndex = lpsOrientation[axis.value];
  const mode = [SlicingMode.I, SlicingMode.J, SlicingMode.K][ijkIndex];
  sliceRep.mapper.setSlicingMode(mode);
});

const slice = vtkFieldRef(sliceRep.mapper, 'slice');
syncRefs(sliceConfig.slice, slice, { immediate: true });

const colorLevel = vtkFieldRef(sliceRep.property, 'colorLevel');
const colorWindow = vtkFieldRef(sliceRep.property, 'colorWindow');
syncRefs(wlConfig.level, colorLevel, { immediate: true });
syncRefs(wlConfig.width, colorWindow, { immediate: true });

defineExpose(sliceRep);
</script>

<template>
  <slot></slot>
</template>
