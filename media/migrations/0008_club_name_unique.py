from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("media", "0007_add_genres_to_shelf"),
    ]

    operations = [
        migrations.AlterField(
            model_name="club",
            name="name",
            field=models.CharField(max_length=150, unique=True),
        ),
    ]
