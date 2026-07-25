using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailPreferencesAndKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_reminder_event_id_user_id",
                table: "event_reminder");

            migrationBuilder.DropColumn(
                name: "email_reminders_enabled",
                table: "app_user");

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "event_reminder",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "PicksClosing"); // existing rows predate kinds; shipped behavior was the close email

            migrationBuilder.CreateTable(
                name: "email_preference",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_email_preference", x => x.id);
                    table.ForeignKey(
                        name: "fk_email_preference_app_user_user_id",
                        column: x => x.user_id,
                        principalTable: "app_user",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_reminder_event_id_user_id_kind",
                table: "event_reminder",
                columns: new[] { "event_id", "user_id", "kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_email_preference_user_id_kind",
                table: "email_preference",
                columns: new[] { "user_id", "kind" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_preference");

            migrationBuilder.DropIndex(
                name: "ix_event_reminder_event_id_user_id_kind",
                table: "event_reminder");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "event_reminder");

            migrationBuilder.AddColumn<bool>(
                name: "email_reminders_enabled",
                table: "app_user",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "ix_event_reminder_event_id_user_id",
                table: "event_reminder",
                columns: new[] { "event_id", "user_id" },
                unique: true);
        }
    }
}
