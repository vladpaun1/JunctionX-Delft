# backend/apps/api/serializers.py
from rest_framework import serializers
from apps.web.models import UploadJob


class UploadJobListSerializer(serializers.ModelSerializer):
    filename = serializers.SerializerMethodField()

    class Meta:
        model = UploadJob
        fields = [
            "id",
            "status",
            "error",
            "created_at",
            "filename",
            "src_size",
            "wav_size",
            "duration_sec",
        ]

    def get_filename(self, obj: UploadJob):
        # best-effort filename for list rows
        if obj.original_name:
            return obj.original_name
        if obj.upload_rel:
            return obj.upload_rel.rsplit("/", 1)[-1]
        if obj.upload_path:
            return obj.upload_path.rsplit("/", 1)[-1]
        return obj.stored_name or ""


class UploadJobDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadJob
        fields = [
            "id",
            "status",
            "error",
            "created_at",
            "started_at",
            "finished_at",
            "upload_rel",
            "normalized_rel",
            "src_size",
            "wav_size",
            "duration_sec",
            "full_text",
            "labels",
            "original_name",
            "stored_name",
        ]
        read_only_fields = fields  # expose read-only over the API
