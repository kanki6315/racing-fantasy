using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailEventsAndSuppression : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ses_message_id",
                table: "event_reminder",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "email_suppressed_at",
                table: "app_user",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "email_event",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    subtype = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    ses_message_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    sns_message_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    raw = table.Column<string>(type: "jsonb", nullable: false),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_email_event", x => x.id);
                    table.ForeignKey(
                        name: "fk_email_event_app_user_user_id",
                        column: x => x.user_id,
                        principalTable: "app_user",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_email_event_email",
                table: "email_event",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "ix_email_event_sns_message_id_email",
                table: "email_event",
                columns: new[] { "sns_message_id", "email" },
                unique: true,
                filter: "sns_message_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_email_event_user_id",
                table: "email_event",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_event");

            migrationBuilder.DropColumn(
                name: "ses_message_id",
                table: "event_reminder");

            migrationBuilder.DropColumn(
                name: "email_suppressed_at",
                table: "app_user");
        }
    }
}
