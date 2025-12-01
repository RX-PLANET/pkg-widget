<template>
    <div class="w-upload-image">
        <div
            v-if="data"
            class="u-image"
            :style="{ width, height }"
            :class="{ 'is-circle': isCircle }"
        >
            <img class="u-image-pic" :src="data" />
            <i class="u-image-mask"></i>
            <i class="u-image-delete" title="移除" @click="remove"
                ><img src="../../assets/img/trash.svg" alt="移除"
            /></i>
        </div>
        <div v-else class="u-upload" :class="{ 'is-circle': isCircle }" @click="select" :style="{ width, height }" v-loading="loading">
            <i class="u-upload-icon">＋</i>
        </div>
        <input
            class="u-upload-input"
            type="file"
            @change="add"
            ref="uploadInput"
            :accept="accept"
        />
    </div>
</template>

<script>
import {buildOssSuffix} from "@2kog/pkg-common/utils/common";
import cloneDeep from "lodash/cloneDeep";
export default {
    name: "UploadImage",
    props: {
        // 图片地址
        url: {
            type: String,
            default: "",
        },
        defaultAvatar: {
            type: String,
            required: false,
            default: "",
        },
        size: {
            type: Array,
            default: [120, 120],
        },
        shape: {
            type: String,
            default: "square",
        },
        uploadFn: {
            type: Function,
            default: () => {},
            required: true,
        },
        domain: {
            type: String,
            default: "",
            required: true,
        },
        accept: {
            type: Array,
            default: () => [
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".bmp",
                ".webp",
                ".heic",
                ".heif",
            ],
        },
    },
    data() {
        return {
            data: "",
            file: null,

            loading: false,
        };
    },
    computed: {
        isCircle() {
            return this.shape === "circle";
        },
        width() {
            return this.size[0] + "px";
        },
        height() {
            return this.size[1] + "px";
        },
    },
    watch: {
        url: {
            handler: function (val) {
                this.data = val && this.getAvatar(this.domain + val) || cloneDeep(this.defaultAvatar);
            },
            immediate: true,
        }
    },
    methods: {
        select: function () {
            this.$refs.uploadInput.dispatchEvent(new MouseEvent("click"));
        },
        getAvatar(url) {
            const size = this.size.map(item => item * 2)
            return url ? url + buildOssSuffix(size) : "";
        },
        add: function (e) {
            this.file = e.target.files[0];
            // this.data = window.URL.createObjectURL(this.file);
            // this.$emit("update", this.file);
            this.loading = true;
            this.uploadFn(this.file)
                .then((res) => {
                    this.data = this.getAvatar(this.domain + res.data.data);
                    this.$emit("update", res.data.data);
                })
                .finally(() => {
                    this.loading = false;
                });
        },
        remove: function () {
            this.$refs.uploadInput.value = "";
            this.data = "";
            this.data.startsWith("blob:") &&
                window.URL.revokeObjectURL(this.data);
            this.$emit("update", "");
        },
    },
};
</script>

<style lang="less">
@import "../../assets/css/component/upload-image.less";
</style>
