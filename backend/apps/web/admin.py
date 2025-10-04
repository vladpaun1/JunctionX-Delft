# from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import UploadJob

@admin.register(UploadJob)
class UploadJobAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "created_at", "started_at", "finished_at", "src_size", "wav_size")
    readonly_fields = ("created_at", "started_at", "finished_at", "upload_path", "normalized_path")
    search_fields = ("id", "upload_rel", "normalized_rel", "full_text")
